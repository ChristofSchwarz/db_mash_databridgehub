const enigmaSchema = 'https://unpkg.com/enigma.js@2.2.0/schemas/12.34.11.json';

require.config({
    baseUrl: location.href.split('/extensions')[0] + "/resources"
});

require(["../extensions/databridge/functions", 'js/qlik', 'https://unpkg.com/enigma.js/enigma.min.js'
], function (functions, qlik, enigma) {
    $.getJSON('./settings.json').then(function (settings) {
        console.log('settings', settings);

        const config = {
            wssUrl: location.protocol.replace('http', 'ws')
                + location.href.split('/extensions')[0].replace(location.protocol, '') + '/app/',
            baseUrl: location.href.split('/extensions')[0],
            qrsUrl: location.protocol + '//' + location.hostname + (location.port ? ":" + location.port : "")
            /*+ '/' + settings.vproxy.prefix */ + '/qrs/'
        };
        console.log('config', config);

        var httpHeader = {};
        var thisUser;
        var dataConnectionExists = false;
        var stream;
        var xrfKey;
        newXrfKey();
        var contextMenu;

        // who is the user?
        $.ajax({ method: 'GET', url: config.baseUrl + '/qps/user' })
            .then(function (user) {
                thisUser = user.userDirectory + '\\' + user.userId;
                //httpHeader[settings.vproxy.headerKey] = thisUser;
                $('.user-id').text(user.userId);
                $('.user-dir').text(user.userDirectory);
                // has the user any admin roles?
                functions.qrsCall('GET', config.qrsUrl + "user/full?filter=userId eq '" + user.userId
                    + "' and userDirectory eq '" + user.userDirectory + "'", httpHeader)
                    .then(function (qrsUser) {
                        const roles = qrsUser[0].roles;
                        if (roles == []) {
                            $('#adminroles').text('-none-');
                        } else {
                            $('#adminroles').text(roles.join(', '));
                        }
                        if (roles.indexOf('RootAdmin') > -1 || roles.indexOf('ContentAdmin') > -1) {
                            $('#adminrolesIcon').addClass('lui-icon--tick');
                        } else {
                            $('#adminrolesIcon').addClass('lui-icon--warning');
                        }
                    });
            });

        // make a first connection to QRS API
        functions.qrsCall('GET', config.qrsUrl + 'about', httpHeader)
            .then(function (res) {
                $("#qrsconnected").html('connected (' + res.buildVersion + ')');
                determineStream();
            })
            .catch(function (err) {
                console.log(err);
            });

        functions.qrsCall('GET', config.qrsUrl + "dataconnection/count?filter=type eq 'folder' and name eq '" + settings.dataConnection + "'", httpHeader)
            .then(function (res) {
                if (res.value == 0) {
                    $("#dConnectionIcon").on('click', function () {
                        functions.luiDialog('errDataConnection', 'Error'
                            , '<div style="display:flex;">'
                            + '  <div style="flex-basis: 20px; margin: 5px">'
                            + '    <span class="lui-icon  lui-icon--large  lui-icon--warning" style="margin: 0 15px 10px 0;"></span>'
                            + '  </div>'
                            + '  <div> Data connection "' + settings.dataConnection + '" doesn\'t exist.'
                            + '    A connection to the folder, where the app binaries are stored, should be created and configured'
                            + '    to get full functionality while copying data from one app to the other.'
                            + '  </div>'
                            + '</div>', null, 'Confirm', false);
                    });
                    $("#dConnectionIcon").addClass('lui-icon--warning-triangle');
                    $("#dConnection").html('"' + settings.dataConnection + '" missing');
                    $('#dConnection').parent().css('background-color', '#bc8218');

                } else {
                    dataConnectionExists = true;
                    $("#dConnectionIcon").addClass('lui-icon--tick');
                    $("#dConnection").html('"' + settings.dataConnection + '" found');
                }
            });


        //----------------------------------- MAIN CODE --------------------------------

        qlik.setOnError(function (error) {
            functions.luiDialog('error', 'Message', error.message, null, 'Close', false);
        });

        $("#hubtitle").text(settings.hubTitle);
        $.get('./databridge.qext').then(function (ret) {
            $("#mashupversion").text(ret.version);
        });

        var image = $('#logo');
        if (settings.logoUrl.length > 0) {
            image.fadeOut(1000, function () {
                image.css("background-image", "url(" + settings.logoUrl + ")");
                image.fadeIn(1000);
            });
        }

        $("#searchtxt").on("keypress", function (e) {
            if (e.which == 13) loadApps($("#searchtxt").val());
        })

        $("#clearsearch").on("click", function () {
            loadApps();
            $("#searchtxt").val("");
        });

        $("#btn_help").on("click", function () {
            $.ajax({ method: 'GET', url: './forms/help.html' }).then(async function (res) {
                functions.luiDialog('showhelp', 'Help about data/\\bridge hub', res, null, 'Close', false);
                const latestVersion = await $.getJSON(
                    'https://raw.githubusercontent.com/ChristofSchwarz/db_mash_databridgehub/main/databridge.qext');
                $('#help_yourversion').text($('#mashupversion').text());
                $('#help_githubversion').text(latestVersion.version);
            });
        });

        $('#select_stream').on('change', function () {
            stream = $('#select_stream').find(":selected").val();
            loadApps();
            $('#btn_loadapps').removeAttr('disabled');
            $('#btn_uploadnew').removeAttr('disabled');
        });

        var schema
        var usedQuery = [];

        $.get(enigmaSchema)
            .then(function (unpkg_schema) {
                schema = unpkg_schema;
                const session = enigma.create({
                    schema,
                    // Change the url to point to your QIX instance
                    url: config.wssUrl + 'engineData',
                    createSocket: url => new WebSocket(url)
                })

                session.open()
                    .then(global => global.engineVersion())
                    .then(result => $("#enigmaconnected").html('connected (' + result.qComponentVersion + ')'))
                    .then(() => session.close());
            });

        // initialize the context menu
        $.ajax({ method: 'GET', url: './forms/menu.html' }).then(function (res) {
            contextMenu = res;
        });

        $("#btn_loadapps").click(function () {
            loadApps();
        });

        $('#btn_settings').click(function () {
            // Edit the settings as html form
            $.ajax({ method: 'GET', url: './forms/settings_form.html' }).then(function (html) {
                functions.luiDialog('dialogsettings', 'Settings', html, 'Save', 'Cancel', false);
                Object.entries(settings).forEach(function (keyValue) {
                    $('#settings_form').append(
                        '<label class="lui-label">' + keyValue[0] + '</label>' +
                        '<input class="lui-input" id="' + keyValue[0] + '" value="' + keyValue[1] + '"></input>'
                    );
                });
                $('#msgok_dialogsettings').on('click', async function () {
                    // Save settings
                    var newJson = {};
                    console.log('Saving settings');
                    $('#msgparent_dialogsettings input').each(function (i) {
                        newJson[this.id] = this.value;
                    });
                    console.log(newJson);
                    const res = functions.qrsCall('POST', config.qrsUrl + 'extension/databridge/uploadfile'
                        + '?externalpath=settings.json&overwrite=true', httpHeader, JSON.stringify(newJson));
                    location.reload();
                });
            });
        });

        $("#btn_uploadnew").click(function () {
            functions.luiDialog('uploadnew', 'Import new app'
                , '<div id="msgbody">'
                + '  <form id="uploadform">'
                + '    <input id="fileinput" type="file" maxlength="1" accept=".qvf" />'
                + '  </form>'
                + '  <div style="text-align:right;padding-right: 8px;">'
                + '    <button class="lui-button" id="filesubmit" disabled style="margin: 10px 0 10px 0;">Upload</button>'
                + '  </div>'
                + '</div>'
                + '<div id="spinningwheel" style="display:none;">'
                , null, 'Cancel', false);

            $('#uploadform').on('change', '#fileinput', function () {
                $('#filesubmit').attr('disabled', false);
            });

            $('#filesubmit').click(async function () {
                await functions.uploadNew(settings, config, httpHeader, stream);
                loadApps();
            });
        });

        // on Esc-Key close contextmenu
        $(document).keyup(function (e) {
            if (e.key === "Escape" && $('#msgparent_contextmenu').length > 0) {
                $('#msgparent_contextmenu').remove();
            }
        });

        function newXrfKey() {
            xrfKey = Math.random().toString().substr(2).repeat(16).substr(0, 16);
            httpHeader["X-Qlik-Xrfkey"] = xrfKey;
        }

        function createSingleLink(appid, sheetid) {
            return config.baseUrl + '/single?appid=' + appid + '&sheet=' + sheetid + '&opt=currsel,ctxmenu';
        }

        async function determineStream() {
            // 1.) if url has "app" querystring, get stream id from the app
            if (location.search.indexOf("app=") > -1) {
                const appFromUrl = location.search.split('app=')[1].split('&')[0];
                const appInfo = await functions.qrsCall('GET', config.qrsUrl + "app/full?filter=id eq " + appFromUrl, httpHeader);
                if (appInfo.length > 0) {
                    if (appInfo[0].published) {
                        stream = appInfo[0].stream.id
                    } else {
                        stream = 'mywork';
                    }
                }
            }
            // 2.) if app querystring didn't return a stream look for "stream" querystring
            if (!stream) {
                if (location.search.indexOf("stream=") > -1) {
                    const streamFromUrl = location.search.split('stream=')[1].split('&')[0];
                    if (streamFromUrl == 'mywork') {
                        stream = 'mywork';
                    } else {
                        const streamInfo = await functions.qrsCall('GET', config.qrsUrl + "stream?filter=id eq " + streamFromUrl, httpHeader);
                        if (streamInfo.length > 0) {
                            stream = streamInfo[0].id
                        }
                    }
                }
            }
            // 3.) if no "app" and no "stream" querystring returned a stream, try settings.defaultStream
            if (!stream) {
                const streamInfo = await functions.qrsCall('GET', config.qrsUrl + "stream?filter=id eq " + settings.defaultStream, httpHeader);
                if (streamInfo.length > 0) {
                    stream = streamInfo[0].id
                }
            }
            // 4.) if none worked, try the "Everyone" stream
            if (!stream) {
                const streamInfo = await functions.qrsCall('GET', config.qrsUrl + "stream?filter=name eq 'Everone'", httpHeader);
                if (streamInfo.length > 0) {
                    stream = streamInfo[0].id
                }
            }
            // 5.) fill the streams dropdown
            functions.qrsCall('GET', config.qrsUrl + 'stream?orderBy=name', httpHeader)
                .then(function (streams) {
                    $('#select_stream').append($('<option></option>').val('mywork').html('My Work'));
                    for (var i = 0; i < streams.length; i++) {

                        $('#select_stream').append($('<option></option>')
                            .val(streams[i].id).html(streams[i].name)).attr('selected');
                        if (streams[i].id == stream) $('#select_stream').val(streams[i].id);
                    }
                });
            // if no stream was found, show a message instead of app icons
            if (!stream) {
                $('#applist').append('<li style="list-style: none;margin-top: 15px;">'
                    + '<span class="lui-icon  lui-icon--warning-triangle"></span>'
                    + ' &nbsp;No stream selected, please choose one above.</li>');
            } else {
                loadApps();
                $('#btn_loadapps').removeAttr('disabled');
                $('#btn_uploadnew').removeAttr('disabled');
            }
        }

        function loadApps(moreFilter) {
            const filter = (stream == 'mywork' ?
                "published eq false and owner.userId eq '" + thisUser.split('\\')[1] + "' and owner.userDirectory eq '" + thisUser.split('\\')[0] + "'"
                : "stream.id eq " + stream
            );
            functions.qrsCall('GET', config.qrsUrl + "app/full?filter=" + filter
                + (moreFilter ? (" and name so '" + moreFilter + "'") : '')
                + '&orderBy=name', httpHeader)
                .then(function (appList) {
                    $("#applist").empty();
                    $('#appcounter').text('(' + appList.length + ')');
                    appList.forEach(function (app) {
                        $("#applist").append(functions.createAppIcon(app.id, app.name));
                        $('#info_' + app.id).on('mouseover', async function () {
                            console.log(app);
                            $('#qs-page-container').append('<div id="div_moreinfo" class="lui-tooltip" style="width: 300px;word-break: break-all;">'
                                + '<b>Name: </b>' + app.name + '<br/>'
                                + '<b>Id: </b>' + app.id + '<br/>'
                                + '<b>Owner: </b>' + app.owner.userDirectory + '\\' + app.owner.userId + '<br/>'
                                + '<b>Created </b>' + app.createdDate.replace('T', ' ') + '<br/>'
                                + '<b>Published </b><span id="span_publishedat">...</span><br/>'
                                + '<b>Reloaded </b><span id="span_reloadedat">...</span><br/>'
                                + '<b>Datamodel Hash: </b><span id="span_dmhash">...</span><br/>'
                                + '<b>Script Hash: </b><span id="span_scripthash">...</span>'
                                + '<div class="lui-tooltip__arrow lui-tooltip__arrow--top"></div></div>');
                            const pos = $('#' + app.id).offset();
                            $('#div_moreinfo').css('top', pos.top + 100);
                            $('#div_moreinfo').css('left', pos.left - 30);
                            const adHocInfo = await functions.qrsCall('GET', config.qrsUrl + 'app/' + app.id, httpHeader);
                            $('#span_publishedat').text(adHocInfo.publishTime.split('.')[0].replace('T', ' '));
                            $('#span_reloadedat').text(adHocInfo.lastReloadTime.split('.')[0].replace('T', ' '));
                            const adHocScriptInfo = await functions.qrsCall('GET', config.qrsUrl + 'app/object?filter=app.id eq '
                                + app.id + " and objectType eq 'app_appscript'", httpHeader);
                            $('#span_scripthash').text(adHocScriptInfo[0].contentHash);
                            const adHocDMInfo = await functions.qrsCall('GET', config.qrsUrl + 'app/object?filter=app.id eq '
                                + app.id + " and objectType eq 'loadModel'", httpHeader);
                            $('#span_dmhash').text(adHocDMInfo[0].contentHash);
                        });
                        $('#info_' + app.id).on('mouseout', function () {
                            $('#div_moreinfo').remove();
                        });

                        if (app.thumbnail.length > 1)
                            $("#" + app.id).find('.list-icon').html('<img src="'
                                + config.baseUrl + app.thumbnail + '" style="width:164px;height:109px;" />');
                        // get the sheet id's for each app

                        $('#' + app.id).click(function () {

                            // ----------- CONTEXT MENU ----------- 
                            functions.luiDialog('contextmenu', app.name, contextMenu, null, 'Close', false);

                            // draw the paths in all the svg <d> tags (circle and checkmark)
                            $('.checkcircle').attr('d', "M437.019,74.98C388.667,26.629,324.38,0,256,0C187.619,0,123.331,26.629,74.98,74.98C26.628,123.332,0,187.62,0,256"
                                + " s26.628,132.667,74.98,181.019C123.332,485.371,187.619,512,256,512c68.38,0,132.667-26.629,181.019-74.981"
                                + " C485.371,388.667,512,324.38,512,256S485.371,123.333,437.019,74.98z M256,482C131.383,482,30,380.617,30,256S131.383,30,256,30"
                                + "	s226,101.383,226,226S380.617,482,256,482z");

                            $('.checktick').attr('d', "M378.305,173.859c-5.857-5.856-15.355-5.856-21.212,0.001L224.634,306.319l-69.727-69.727"
                                + " c-5.857-5.857-15.355-5.857-21.213,0c-5.858,5.857-5.858,15.355,0,21.213l80.333,80.333c2.929,2.929,6.768,4.393,10.606,4.393"
                                + "	c3.838,0,7.678-1.465,10.606-4.393l143.066-143.066C384.163,189.215,384.163,179.717,378.305,173.859z");

                            $('#input_appname').val(app.name);
                            $('#appowner').text(app.owner.userDirectory + '\\' + app.owner.userId);
                            $('#appstream').text(app.published ? app.stream.name : 'not published');
                            $('#appid').text(app.id);
                            if (thisUser == (app.owner.userDirectory + '\\' + app.owner.userId)) {
                                // user is the owner of the current app
                                $('#btn_showscript').show(); //.removeAttr('disabled');
                                $('#owneractions').show();
                            } else {
                                $('#btn_makemeowner').show(); //removeAttr('disabled');
                            }

                            $('#refreshfromfile').on('click', function () {
                                $('#refreshfromfile').addClass('lui-button--info');
                                $('#refreshfrommyapp').removeClass('lui-button--info');
                                $('#refreshfrompubapp').removeClass('lui-button--info');
                                functions.enableDisableButton();
                                $('#uploadform').show();
                                $('#myappslist').hide();
                            });
                            $('#refreshfrommyapp').on('click', function () {
                                $('#refreshfrommyapp').addClass('lui-button--info');
                                $('#refreshfromfile').removeClass('lui-button--info');
                                $('#refreshfrompubapp').removeClass('lui-button--info');
                                functions.enableDisableButton();
                                $('#uploadform').hide();
                                $('#myappslist').empty().show();
                                functions.qrsCall('GET', config.qrsUrl + "app/full?orderBy=name&filter=published eq false and owner.userId eq '"
                                    + thisUser.split('\\')[1] + "' and owner.userDirectory eq '" + thisUser.split('\\')[0] + "'"
                                    , httpHeader)
                                    .then(function (appList) {
                                        appList.forEach(function (app) {
                                            $('#myappslist').append('<option value="' + app.id + '">' + app.name + '</option>');
                                        });
                                    })
                            });
                            $('#refreshfrompubapp').on('click', function () {
                                $('#refreshfrompubapp').addClass('lui-button--info');
                                $('#refreshfromfile').removeClass('lui-button--info');
                                $('#refreshfrommyapp').removeClass('lui-button--info');
                                functions.enableDisableButton();
                                $('#uploadform').hide();
                                $('#myappslist').empty().show();
                                functions.qrsCall('GET', config.qrsUrl + "app/full?orderBy=name&filter=published eq true"
                                    , httpHeader)
                                    .then(function (appList) {
                                        appList.forEach(function (app) {
                                            $('#myappslist').append('<option value="' + app.id + '">' + app.name
                                                + (app.stream ? ' &lt;' + app.stream.name + '&gt;' : '') + '</option>');
                                        });
                                    })
                            });

                            $('#btn_next').on('click', async function () {
                                // $('#uploadform').hide();
                                // $('#myappslist').hide();
                                const fromFile = $('#refreshfromfile').hasClass('lui-button--info');
                                const origAppId = $('#myappslist :selected').val();
                                $('#contextmenu').hide();
                                $('#spinningwheel').show();
                                if (fromFile) {
                                    $('#fromapp_name').text($('#fileinput')[0].files[0].name);
                                } else {
                                    srcAppInfo = await functions.qrsCall('GET', config.qrsUrl + 'app/full?filter=id eq ' + origAppId, httpHeader);
                                    if (srcAppInfo.length == 0) {
                                        $('#msgparent_contextmenu').remove();
                                        functions.luiDialog('359', 'Error', 'No such app with id ' + origAppId
                                            , null, 'Close', false);
                                    } else {
                                        $('#fromapp_name').text(srcAppInfo[0].name);
                                        $('#fromapp_id').text(srcAppInfo[0].id);
                                        $('#fromapp_owner').text(srcAppInfo[0].owner.userDirectory + '\\' + srcAppInfo[0].owner.userId);
                                        $('#fromapp_stream').text(srcAppInfo[0].published ? srcAppInfo[0].stream.name : 'unpublished');
                                    }
                                }

                                $('#toapp_name').text(app.name);
                                $('#toapp_id').text(app.id);
                                $('#toapp_owner').text(app.owner.userDirectory + '\\' + app.owner.userId);
                                $('#toapp_stream').text(app.published ? app.stream.name : 'unpublished');
                                $('#msgparent_contextmenu .lui-dialog').css('width', '600px');
                                $('#msgparent_contextmenu .lui-dialog__title').text('Copy Tool');
                                functions.previewSteps();
                                $('#spinningwheel').hide();
                                $('#copyconfirm').show();
                                $('#steplist_parent').show();
                            });

                            $('#uploadform').on('change', '#fileinput', function () {
                                functions.enableDisableButton();
                            });
                            $('#importdesign').change(function () { functions.previewSteps(); });
                            $('#importdata').change(function () { functions.previewSteps(); });
                            $('#importscript').change(function () { functions.previewSteps(); });
                            /*
                            $('#myappslist').on('change', function () {
                                $('#btn_replace').attr("disabled", $('#myappslist').find(":selected").val() == "");
                            });*/

                            // if query-string importdata is used, check the option
                            if (location.search.indexOf("importdesign") > -1 && usedQuery.indexOf('importdesign') == -1) {
                                $('#importdesign').prop('checked', true);
                                functions.enableDisableButton();
                                usedQuery.push('importdesign');
                            }
                            if (location.search.indexOf("importdata") > -1 && usedQuery.indexOf('importdata') == -1) {
                                $('#importdata').prop('checked', true);
                                functions.enableDisableButton();
                                usedQuery.push('importdata');
                            }
                            if (location.search.indexOf("importscript") > -1 && usedQuery.indexOf('importdata') == -1) {
                                $('#importscript').prop('checked', true);
                                functions.enableDisableButton();
                                usedQuery.push('importscript');
                            }

                            // if (!dataConnectionExists) {
                            //     // without data connection the option "importdata" cannot be unselected 
                            //     $('#importdata').prop('checked', true)
                            //     $('#importdata').attr('disabled', true)
                            // }

                            if (location.search.indexOf("from=file") > -1 && usedQuery.indexOf('from') == -1) {
                                usedQuery.push('from');
                                $('#refreshfromfile').addClass('lui-button--info');
                                $('#uploadform').show();
                            }

                            if (location.search.indexOf("from=") > -1 && usedQuery.indexOf('from') == -1) {
                                usedQuery.push('from');
                                const from = location.search.split('from=')[1].split('&')[0];
                                $('#myappslist').show();
                                $('#myappslist').append('<option value="' + from + '">' + from + '</option>');
                                //functions.enableDisableButton();
                                // trigger button.click of .next button
                                $('#btn_next').attr('disabled', false);
                                $('#btn_next').click();
                            }

                            functions.qrsCall('GET', config.qrsUrl + "app/object?filter=objectType eq 'sheet' and app.id eq " + app.id, httpHeader)
                                .then(function (sheetList) {
                                    $('#sheetcounter').text(sheetList.length);
                                    sheetList.forEach(function (sheet, i) {
                                        //console.log(sheet);
                                        $('#sheetlist').append('<option value="' + sheet.engineObjectId + '">' + sheet.name + '</option>');
                                        if (i == 0) {
                                            // arm the first available sheet to the button href
                                            $("#opensheet").attr("href", createSingleLink(app.id, sheet.engineObjectId));
                                        }
                                    });
                                    $("#sheetlist").change(function () {
                                        $("#opensheet").attr("href", createSingleLink(app.id, $('#sheetlist').find(":selected").val()));
                                        //.attr("disabled", $('#sheetlist').find(":selected").val() == "");
                                    });
                                })


                            $('#btn_makemeowner').click(function () {
                                functions.luiDialog('confirm', 'Confirm', 'Change app owner to you?', 'Yes', 'No', false);
                                $('#msgok_confirm').click(async function () {
                                    $('#msgparent_confirm').remove();
                                    $('#spinningwheel').show();
                                    $('#contextmenu').hide();
                                    const usrInfo = await functions.qrsCall('GET', config.qrsUrl + "user?filter=userId eq '"
                                        + thisUser.split('\\')[1] + "' and userDirectory eq '" + thisUser.split('\\')[0] + "'", httpHeader);
                                    const chgApp = await functions.qrsCall('PUT', config.qrsUrl + 'app/' + app.id, httpHeader, JSON.stringify({
                                        owner: { id: usrInfo[0].id },
                                        modifiedDate: "2199-12-31T23:59:59.999Z"
                                    }));
                                    $('#msgparent_contextmenu').remove();
                                    loadApps();
                                })
                            });

                            $('#btn_duplicate').click(function () {
                                functions.luiDialog('confirm', 'Duplicate App', 'Are you sure to copy the entire app?', 'Duplicate', 'Cancel', false);
                                $('#msgok_confirm').click(async function () {
                                    $('#msgparent_confirm').remove();
                                    $('#spinningwheel').show();
                                    $('#contextmenu').hide();
                                    const newApp = await functions.qrsCall('POST', config.qrsUrl + 'app/' + app.id + '/copy', httpHeader);
                                    if (stream != 'mywork') {
                                        const result = await functions.qrsCall('PUT', config.qrsUrl + 'app/' + newApp.id + '/publish?stream=' + stream, httpHeader);
                                    }
                                    $('#msgparent_contextmenu').remove();
                                    loadApps();
                                })
                            });

                            $('#btn_deleteapp').click(function () {
                                functions.luiDialog('confirm', 'Confirm Deletion', 'Are you sure to delete the app permanently?', 'Delete', 'Cancel', false);
                                $('#msgok_confirm').click(async function () {
                                    $('#msgparent_confirm').remove();
                                    $('#spinningwheel').show();
                                    $('#contextmenu').hide();
                                    const ret = await functions.qrsCall('DELETE', config.qrsUrl + 'app/' + app.id, httpHeader);
                                    $('#msgparent_contextmenu').remove();
                                    loadApps();
                                })
                            });


                            $('#btn_showscript').click(async function () {
                                functions.showScript(enigma, schema, config, app)
                            });

                            $('#btn_showdatamodel').click(async function () {
                                functions.showDataModel(enigma, schema, config, app, httpHeader)
                            });

                            $('#btn_reload').click(function () {
                                functions.luiDialog('confirm', 'Confirm Reload', "Trigger ad-hoc reload in background?", 'Reload', 'Cancel', false);
                                $('#msgok_confirm').click(async function () {
                                    //const ret = await functions.qrsCall('POST', config.qrsUrl + 'app/' + app.id + '/reload', httpHeader);
                                    $('#msgparent_confirm').remove();
                                    $('#msgparent_contextmenu').remove();
                                    functions.reloadApp(app.id, config, httpHeader);
                                })
                            });

                            $('#btn_editname').click(async function () {
                                $('#div_editname').show();
                                $('#contextmenu').hide();
                                $('#btn_saveappname').on('click', async function () {
                                    $('#spinningwheel').show();
                                    $('#div_editname').hide();
                                    $('')
                                    const chgApp = await functions.qrsCall('PUT', config.qrsUrl + 'app/' + app.id, httpHeader, JSON.stringify({
                                        name: $("#input_appname").val(),
                                        modifiedDate: "2199-12-31T23:59:59.999Z"
                                    }));
                                    $('#msgparent_contextmenu').remove();
                                    loadApps();
                                });
                            });

                            $('#btn_startcopy').click(async function () {
                                $('#copyconfirm').find('*').attr('disabled', true);
                                $('#copyconfirm').fadeTo(1, .5);
                                newXrfKey();
                                await functions.replaceApp(enigma, schema, httpHeader, app, config, settings, thisUser)
                                loadApps();
                            });

                        });

                    })


                })
                .finally(function () {
                    // querystrings controlled opening of context menu
                    if (location.search.indexOf("app=") > -1 && usedQuery.indexOf('app') == -1) {
                        const queryAppId = location.search.split('app=')[1].split('&')[0];
                        usedQuery.push('app');
                        if ($('#' + queryAppId).length > 0) {
                            console.log('Querystring app=' + queryAppId);
                            $('#' + queryAppId).trigger('click');
                        }
                    }
                })
                .catch(function (error) {
                    functions.luiDialog('284', 'Error', JSON.stringify(error), null, 'Close', false);
                });

        }
    });
});
