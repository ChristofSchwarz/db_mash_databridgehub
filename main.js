const enigmaSchema = 'https://unpkg.com/enigma.js@2.2.0/schemas/12.34.11.json';
const settingsFile = 'settings_databridgehub.json';
require.config({
    baseUrl: location.href.split('/extensions')[0] + "/resources"
});

require([
    '../extensions/databridge/functions',
    '../extensions/databridge/loadapps',
    'js/qlik',
    'https://unpkg.com/enigma.js/enigma.min.js',
], function (functions, loadapps, qlik, enigma) {

	if (location.search.indexOf('from') > -1 || location.search.indexOf('app') > -1 || location.search.indexOf('stream') > -1) {
		$('#init').remove();
	} else {
		setTimeout(function(){
			$('#init').fadeOut(1000, function () {
				$('#init').remove();
			});
		}, 300);
	}
	
    // get all the html forms
    var forms = [];
    ['menu.html', 'copy.html', 'help.html', 'hoverinfo.html', 'settings.html'].forEach(function (f) {
        $.ajax({ method: 'GET', url: './forms/' + f }).then(function (res) {
            forms[f] = res;
        });
    })
	      

    const config = {
        wssUrl: location.protocol.replace('http', 'ws')
            + location.href.split('/extensions')[0].replace(location.protocol, '') + '/app/',
        baseUrl: location.href.split('/extensions')[0],
        qrsUrl: location.protocol + '//' + location.hostname + (location.port ? ":" + location.port : "")
            /*+ '/' + settings.vproxy.prefix */ + '/qrs/'
    };
    console.log('config', config);

    const guid_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    var httpHeader = {};
    var xrfKey;
    newXrfKey();
    function newXrfKey() {
        xrfKey = Math.random().toString().substr(2).repeat(16).substr(0, 16);
        httpHeader["X-Qlik-Xrfkey"] = xrfKey;
    }
    var stream;
    //var contextMenu;
    var dataConnectionExists = false;
    var thisUser = $.ajax({ type: 'GET', url: config.baseUrl + '/qps/user', async: false });


    $('.user-id').text(thisUser.responseJSON.userId);
    $('.user-dir').text(thisUser.responseJSON.userDirectory);
    thisUser = thisUser.responseJSON.userDirectory + '\\' + thisUser.responseJSON.userId;
    console.log('thisUser', thisUser);
    const defaultSettings = {
        defaultStream: "ad61b9f3-6c46-4669-be59-4b4718badc17",
        dataConnection: "App_Binaries",
        hubTitle: "Deployment Hub",
        logoUrl: "./pics/dblogo.svg",
        qrsApiConsoleLog: true,
        isQapLicense: false,
        experimentalFeatures: true
    };


    var settings = $.ajax({ type: 'GET', url: '../../content/Default/' + settingsFile, async: false });
    if (settings.status != '200') {
        functions.luiDialog('625', 'Info', 'File ' + settingsFile + ' not found. <span id="trycreatesettings">Trying to create it ...</span>', null, 'Close', false);
        functions.qrsCall('POST', config.qrsUrl + 'ContentLibrary/Default/uploadfile'
            + '?externalpath=' + settingsFile, httpHeader, JSON.stringify(defaultSettings))
            .then(function (res) {
                $('#trycreatesettings').text('Created file successfully. Please reload page.');
            }).catch(function (err) {
                $('#trycreatesettings').text('Cannot create file. You need to be ContentAdmin or RootAdmin to do so.');
            });
    } else {
        settings = { ...defaultSettings, ...settings.responseJSON };

        // let the qrsCall function know with the pseudo-entry X-qrsApiConsoleLog if it should use console.log 
        httpHeader['X-qrsApiConsoleLog'] = settings.qrsApiConsoleLog;

        console.log('settings', settings);
        //var thisUser = $.ajax({ type: 'GET', config.baseUrl + '/qps/user' , async: false });

        // who is the user?
        // $.ajax({ method: 'GET', url: config.baseUrl + '/qps/user' })
        //     .then(function (user) {
        // thisUser = user.userDirectory + '\\' + user.userId;
        //httpHeader[settings.vproxy.headerKey] = thisUser;
        // $('.user-id').text(user.userId);
        // $('.user-dir').text(user.userDirectory);
        // has the user any admin roles?
        functions.qrsCall('GET', config.qrsUrl + "user/full?filter=userId eq '" + thisUser.split('\\')[1]
            + "' and userDirectory eq '" + thisUser.split('\\')[0] + "'", httpHeader)
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
        // });

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

        qlik.setOnError(function (error) {
            functions.luiDialog('error', 'Message', error.message, null, 'Close', false);
        });

        $("#hubtitle").text(settings.hubTitle);
        $.get('./databridge.qext').then(function (ret) {
            $("#mashupversion").text(ret.version);
        });
		
		if (settings.logoUrl.length > 0) {
			$('#logo').css("background-image", "url(" + settings.logoUrl + ")");
		}
		
  

		$('.lui-search .lui-search__search-icon').on('click', function(){
			loadapps.go($("#searchtxt").val(), thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
		});
		
        $("#searchtxt").on("keypress", function (e) {
            if (e.which == 13)
                loadapps.go($("#searchtxt").val(), thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
        })

        $("#clearsearch").on("click", function () {
			$("#searchtxt").val("");
            loadapps.go(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
        });

        $('#uploadform2').on('change', '#fileinput2', function () {
            $('#uploadfilename').html($('#fileinput2')[0].files[0].name
                + '<br /><br /><span class="lui-icon  lui-icon--large  lui-icon--upload"></span>');
            $('#uploadicon').show();
            $('#clearuploadform2').show();
            $('#startcopy').show();
            //$('#uploadform2').hide();
            $('#dropzone').hide();
        });

        $('#clearuploadform2').on('click', function () {
            $('#uploadfilename').text('');
            $('#fileinput2').val('');
            $('#uploadicon').hide();
            $('#startcopy').hide();
            $('#clearuploadform2').hide();
            //$('#uploadform2').show();
            $('#dropzone').show();
        });

        $('.maintool').on('click', async function () {
            var appList = []
            $('.devhub-list-item').each(function (i, e) {
                if ($(e).find('input').is(':checked')) {
                    appList.push({
                        id: e.id,
                        name: $('#' + e.id).attr('name'),
                        owner: $('#' + e.id).attr('owner'),
                        stream: $('#' + e.id).attr('stream'),
						tags: $('#' + e.id).attr('tags'),
                    })
                }
            });
            if (appList.length == 0) {
                functions.luiDialog('err202', 'Error', 'No target app selected', null, 'Close', false);
                return false;
            }
            
			const licensed = settings.experimentalFeatures;
			var removeTag, addTag, dontAddSheets;
			const fromFile = $('#fileinput2')[0].files.length > 0;
            var from_appId, fileinput2;
			
			from_appId = $('.draggedicon').attr('appid');
            functions.luiDialog('copytool', 'Deployment Tool', forms['copy.html'], null, 'Close', false, 700);
            //functions.luiDialog('copytool', 'Copy Tool', res, null, 'Close', false, 700);

            // preselect the options according to url querystrings
			
            if (from_appId && (location.search.indexOf("?importdesign") > -1 || location.search.indexOf("&importdesign") > -1 ))
				$('#importdesign').attr('checked', 'checked');
            if (from_appId && (location.search.indexOf("?importdata") > -1 || location.search.indexOf("&importdata") > -1))
				$('#importdata').attr('checked', 'checked');
            if (from_appId && (location.search.indexOf("?importscript") > -1 || location.search.indexOf("&importscript") > -1)) 
				$('#importscript').attr('checked', 'checked');
            if (location.search.indexOf("?reloadafter") > -1 || location.search.indexOf("?reloadafter") > -1) 
				$('#reloadafter').attr('checked', 'checked');
			if (location.search.indexOf("removetag=") > -1) {
				$('#check_removetag').attr('checked', 'checked');
				removeTag = decodeURIComponent(location.search.split('removetag=')[1].split('&')[0]);
			}
			if (location.search.indexOf("addtag=") > -1) {
				$('#check_addtag').attr('checked', 'checked');
				addTag = decodeURIComponent(location.search.split('addtag=')[1].split('&')[0]);
				$('#input_addtag').val(addTag);
			}
			


            if (!fromFile) {
                
			    if (from_appId) {
					const from_appInfo = await functions.qrsCall('GET', config.qrsUrl + "app/" + from_appId, httpHeader);
					$('#fromapp_id').text(from_appId);
					$('#fromapp_name').text(from_appInfo.name);
					from_appInfo.tags.forEach(function(tag){ 
						$('#fromapp_tags').append('<span class="apptag_grey">' + tag.name + '</span>')
					});
					$('#fromapp_owner').text(from_appInfo.owner.userDirectory + '\\' + from_appInfo.owner.userId);
					$('#fromapp_stream').text(from_appInfo.published ? from_appInfo.stream.name : 'unpublished');
				} else {
					$('#importdesign').attr('disabled', true);
					$('#importscript').attr('disabled', true);
					$('#importdata').attr('disabled', true);
				}
            } else {
                fileinput2 = document.getElementById('fileinput2').files[0];
                $('#fromapp_name').text($('#fileinput2')[0].files[0].name);
                $('#fromapp_owner').text(thisUser);
            }

            $('#toapp_id').text(appList.length == 1 ? appList[0].id : '-multiple-');
            $('#toapp_name').text(appList.length == 1 ? appList[0].name : (appList.length + ' apps'));
            $('#toapp_owner').text(appList.length == 1 ? appList[0].owner : '');
            $('#toapp_stream').text(appList[0].stream);
			if (appList.length == 1 && appList[0].tags.length > 0) 
				$('#toapp_tags').html('<span class="apptag_grey">' + appList[0].tags.split('|').join('</span><span class="apptag_grey">') + '</span>');


			functions.qrsCall('GET', config.qrsUrl + "tag?orderBy=name", httpHeader).then(function(tags){
				for(var i=0;i<tags.length;i++) {
					$('#select_removetag').append('<option' + (tags[i].name == removeTag ? ' selected' : '') + '>' + tags[i].name + '</option>');
					$('#datalist_addtag').append('<option value="' + tags[i].name + '">');
				}
			})
			
            functions.previewSteps(thisUser, appList, fromFile, licensed);
			
            $('#importdesign').change(function () { functions.previewSteps(thisUser, appList, fromFile, licensed); });
            $('#importdata').change(function () { functions.previewSteps(thisUser, appList, fromFile, licensed); });
            $('#importscript').change(function () { functions.previewSteps(thisUser, appList, fromFile, licensed); });
            $('#reloadafter').change(function () { functions.previewSteps(thisUser, appList, fromFile, licensed); });
			$('#check_removetag').change(function () { functions.previewSteps(thisUser, appList, fromFile, licensed); });
			$('#select_removetag').change(function () { functions.previewSteps(thisUser, appList, fromFile, licensed); });
			$('#check_addtag').change(function () { functions.previewSteps(thisUser, appList, fromFile, licensed); });
			$('#input_addtag').change(function () { functions.previewSteps(thisUser, appList, fromFile, licensed); });
			$('#nonewsheets').change(function () { functions.previewSteps(thisUser, appList, fromFile, licensed); });
            $('#btn_startcopy').click(async function () {
                $('#copyconfirm').find('*').attr('disabled', true);
                $('#copyconfirm').fadeTo(1, .5);
                newXrfKey();
				const removeTag = $('#check_removetag').is(':checked') ? $('#select_removetag option:selected').val() : null;
				const addTag = $('#check_addtag').is(':checked') ? $('#input_addtag').val() : null;
				const noNewSheets = $('#importdesign').is(':checked') && $('#nonewsheets').is(':checked');
                await functions.executeSteps(enigma, schema, httpHeader, fromFile ? fileinput2 : from_appId,
                    config, settings, thisUser, appList, addTag, removeTag, noNewSheets);
                loadapps.go(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
            });
            //});
            console.log('Selected Apps:', appList);
        });

        $("#btn_help").on("click", async function () {
            //$.ajax({ method: 'GET', url: './forms/help.html' }).then(async function (res) {
                functions.luiDialog('showhelp', 'Help about data/\\bridge hub', forms['help.html'], null, 'Close', false);
                const latestVersion = await $.getJSON(
                    'https://raw.githubusercontent.com/ChristofSchwarz/db_mash_databridgehub/main/databridge.qext');
                $('#help_yourversion').text($('#mashupversion').text());
                $('#help_githubversion').text(latestVersion.version);
            //});
        });

        $('#select_stream').on('change', function () {
            stream = $('#select_stream').find(":selected").val();
            loadapps.go(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
            $('#btn_loadapps').removeAttr('disabled');
            $('#btn_uploadnew').removeAttr('disabled');
        });


        // initialize the context menu
        /* $.ajax({ method: 'GET', url: './forms/menu.html' }).then(function (res) {
             contextMenu = res;
         });*/

        $("#btn_loadapps").click(function () {
            loadapps.go(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
        });


        $("#selectall2").on('click', function () {
            if ($('#selectall2').is(':checked')) {
                //$('.devhub-list-item .lui-checkbox__input').attr('checked', 'checked');
                $('.devhub-list-item .lui-checkbox__input').each(function (i, e) { e.checked = true; });
            } else {
                //$('.devhub-list-item .lui-checkbox__input').removeAttr('checked');
                $('.devhub-list-item .lui-checkbox__input').each(function (i, e) { e.checked = false; });
            }
        });



        $('#dropzone').on('drop', function (ev) {
            ev.preventDefault();
            var id = ev.originalEvent.dataTransfer.getData("text");
            const clone = document.getElementById(id).cloneNode(true);
            clone.removeAttribute('draggable');
            clone.setAttribute('appid', id);
            clone.classList.add('draggedicon');
            clone.removeAttribute('id');
			var infoIcon = clone.getElementsByClassName('info-icon-wrap');
			console.log('infoIcon', infoIcon);
			infoIcon[0].remove();
            //console.log('drop', clone);
            document.getElementById('sourceapparea').appendChild(clone);
            //ev.target.parentElement.parentElement.appendChild(clone);

            $('.draggedicon .lui-checkbox').remove();
            $('#dropzone').hide();
            //$('#uploadform2').hide();
            $('#cleardropzone').show();
            $('#startcopy').show();
            $('#draggedapp_id').text(id);
            $('#draggedapp_owner').text(clone.getAttribute('owner'));
            $('#draggedapp_stream').text(clone.getAttribute('stream'));
			if (clone.getAttribute('tags').length > 0) {
				$('#draggedapp_tags').parent().show();
				$('#draggedapp_tags').html('<span class="apptag_blue">' 
				+ clone.getAttribute('tags').split('|').join('</span><span class="apptag_blue">')
				+ '</span>')
			} else {
				$('#draggedapp_tags').parent().hide();
			};
            $('#draggedappinfo').show();

        });
        $('#dropzone').on('dragover', function (event) {
            //console.log('dragover ', event);
            event.preventDefault();
        });

        $('#cleardropzone').on('click', function () {
            $('.draggedicon').remove();
            $('#dropzone').show();
            //$('#uploadform2').show();
            $('#cleardropzone').hide();
            $('#startcopy').hide();
            $('#draggedappinfo').hide('');
        });

        $('#btn_settings').on('click', function () {
            // Edit the settings as html form
            //$.ajax({ method: 'GET', url: './forms/settings_form.html' }).then(function (html) {
            //functions.luiDialog('dialogsettings', 'Settings', html, 'Save', 'Cancel', false);
            functions.luiDialog('dialogsettings', 'Settings', forms['settings.html'], 'Save', 'Cancel', false);
            Object.entries(settings).forEach(function (keyValue) {
                if (typeof (keyValue[1]) != 'boolean') {
                    $('#settings_form').append(
                        '<label class="lui-label">' + keyValue[0] + '</label>' +
                        '<input class="lui-input" id="' + keyValue[0] + '" value="' + keyValue[1] + '"' +
                        // offer list for dataConnection
                        (keyValue[0] == "dataConnection" ? ' list="list_dataConnections"' : '') + '></input>'
                    );
                } else {
                    $('#settings_form').append(
                        '<label class="lui-label  lui-checkbox">'
                        + '<input class="lui-checkbox__input" type="checkbox" id="' + keyValue[0] + '"' + (keyValue[1] ? ' checked />' : ' />')
                        + '<div class="lui-checkbox__check-wrap">'
                        + '<span class="lui-checkbox__check"></span>'
                        + '<span class="lui-checkbox__check-text">' + keyValue[0] + '</span>'
                        + '</div>'
                        + '</label>'
                    );
                }
            });
            // offer a list of data connections
            $('#settings_form').append('<datalist id="list_dataConnections"></datalist>')
            functions.qrsCall('GET', config.qrsUrl + "dataconnection?filter=type eq 'folder'&orderBy=name", httpHeader)
                .then(function (res) {
                    res.forEach(function (conn) { $('#list_dataConnections').append('<option value="' + conn.name + '"/>'); });
                })
            $('#msgok_dialogsettings').on('click', async function () {
                // Save settings
                var newJson = {};
                console.log('Saving settings');
                $('#msgparent_dialogsettings input').each(function (i) {
                    if (this.type == 'checkbox')
                        newJson[this.id] = this.checked;
                    else
                        newJson[this.id] = this.value;
                });
                console.log(newJson);
                //const res = functions.qrsCall('POST', config.qrsUrl + 'extension/databridge/uploadfile'
                //    + '?externalpath=settings.json&overwrite=true', httpHeader, JSON.stringify(newJson));
                const res = functions.qrsCall('POST', config.qrsUrl + 'ContentLibrary/Default/uploadfile'
                    + '?externalpath=' + settingsFile + '&overwrite=true', httpHeader, JSON.stringify(newJson));
                location.reload();
            });
            //});
        });

        $("#btn_uploadnew").on('click', function () {
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
                loadapps.go(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
            });
        });

        // on Esc-Key close contextmenu
        $(document).keyup(function (e) {
            if (e.key === "Escape" && $('#msgparent_contextmenu').length > 0) {
                $('#msgparent_contextmenu').remove();
            }
        });



        // Automated testing, easteregg, click on version number ... 

        $('#mashupversion').on('click', async function () {
            $('.dbhubinfo').hide();
            $('.dbhubtest').show();
        });
        $('#close_testing').on('click', async function () {
            $('.dbhubinfo').show();
            $('.dbhubtest').hide();
        });

        $('#dbhubtest_create').on('click', async function () {
            if ($('.draggedicon').length == 1) {
                var user
                user = await functions.qrsCall('GET', config.qrsUrl + "user?filter=userId eq 'sa_repository'", httpHeader);
                if (user.length == 0) {
                    return alert('Internal user sa_repository not found');
                } else {
                    user = user[0].id;
                    console.log('User sa_repository has id ' + user);
                }
                for (var testRound = 0; testRound < 2; testRound++) {
                    var testStream;
                    var streamName = (testRound == 0 ? 'databridge test n.owner' : 'databridge test owner');
                    testStream = await functions.qrsCall('GET', config.qrsUrl + "stream?filter=name eq '" + streamName + "'", httpHeader);
                    if (testStream.length == 0) {
                        testStream = await functions.qrsCall('POST', config.qrsUrl + "stream", httpHeader, JSON.stringify({ name: streamName }));
                        console.log('Created test stream "' + streamName + '"');
                    } else {
                        testStream = testStream[0];
                    };
                    console.log('Test stream "' + streamName + '" is ', testStream.id);

                    // delete test apps
                    oldApps = await functions.qrsCall('GET', config.qrsUrl + "app?filter=stream.id eq " + testStream.id, httpHeader);
                    oldApps.forEach(function (app, i) {
                        if (i == 0) $('#dbhubtest_output').append('Removing previous test apps<br>');
                        console.log('Deleting test app ' + app.id);
                        functions.qrsCall('DELETE', config.qrsUrl + "app/" + app.id, httpHeader);
                    });
                    const srcAppId = $('#draggedapp_id').text();
                    console.log('Source app is ' + srcAppId);
                    var testApps = [];
                    var testApp;
                    var pLoad = { modifiedDate: "2199-12-31T23:59:59.999Z" };
                    $('#dbhubtest_output').append('Creating test apps from above source<br>');

                    if (testRound == 0) {
                        testApp = await functions.qrsCall('POST', config.qrsUrl + "app/" + srcAppId + "/copy", httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id + '/publish?stream=' + testStream.id, httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id, httpHeader, JSON.stringify({ ...pLoad, ...{ name: "1 default", owner: { id: user } } }));
                        $('#dbhubtest_output').append('*');

                        testApp = await functions.qrsCall('POST', config.qrsUrl + "app/" + srcAppId + "/copy", httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id + '/publish?stream=' + testStream.id, httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id, httpHeader, JSON.stringify({ ...pLoad, ...{ name: "1 owner of target" } }));
                        $('#dbhubtest_output').append('*');
                        testApp = await functions.qrsCall('POST', config.qrsUrl + "app/" + srcAppId + "/copy", httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id + '/publish?stream=' + testStream.id, httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id, httpHeader, JSON.stringify({ ...pLoad, ...{ name: "2 default", owner: { id: user } } }));
                        $('#dbhubtest_output').append('*');

                    } else {
                        testApp = await functions.qrsCall('POST', config.qrsUrl + "app/" + srcAppId + "/copy", httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id + '/publish?stream=' + testStream.id, httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id, httpHeader, JSON.stringify({ ...pLoad, ...{ name: "1o default", owner: { id: user } } }));
                        $('#dbhubtest_output').append('*');

                        testApp = await functions.qrsCall('POST', config.qrsUrl + "app/" + srcAppId + "/copy", httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id + '/publish?stream=' + testStream.id, httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id, httpHeader, JSON.stringify({ ...pLoad, ...{ name: "1o owner of target" } }));
                        $('#dbhubtest_output').append('*');
                        testApp = await functions.qrsCall('POST', config.qrsUrl + "app/" + srcAppId + "/copy", httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id + '/publish?stream=' + testStream.id, httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id, httpHeader, JSON.stringify({ ...pLoad, ...{ name: "2o default", owner: { id: user } } }));
                        $('#dbhubtest_output').append('*');
                        testApp = await functions.qrsCall('POST', config.qrsUrl + "app/" + srcAppId + "/copy", httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id + '/publish?stream=' + testStream.id, httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id, httpHeader, JSON.stringify({ ...pLoad, ...{ name: "3 default", owner: { id: user } } }));
                        $('#dbhubtest_output').append('*');
                        testApp = await functions.qrsCall('POST', config.qrsUrl + "app/" + srcAppId + "/copy", httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id + '/publish?stream=' + testStream.id, httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id, httpHeader, JSON.stringify({ ...pLoad, ...{ name: "4 default", owner: { id: user } } }));
                        $('#dbhubtest_output').append('*');
                        testApp = await functions.qrsCall('POST', config.qrsUrl + "app/" + srcAppId + "/copy", httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id + '/publish?stream=' + testStream.id, httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id, httpHeader, JSON.stringify({ ...pLoad, ...{ name: "4 owner of target" } }));
                        $('#dbhubtest_output').append('*');
                        testApp = await functions.qrsCall('POST', config.qrsUrl + "app/" + srcAppId + "/copy", httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id + '/publish?stream=' + testStream.id, httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id, httpHeader, JSON.stringify({ ...pLoad, ...{ name: "5 default", owner: { id: user } } }));
                        $('#dbhubtest_output').append('*');
                        testApp = await functions.qrsCall('POST', config.qrsUrl + "app/" + srcAppId + "/copy", httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id + '/publish?stream=' + testStream.id, httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id, httpHeader, JSON.stringify({ ...pLoad, ...{ name: "6 default", owner: { id: user } } }));
                        $('#dbhubtest_output').append('*');
                        testApp = await functions.qrsCall('POST', config.qrsUrl + "app/" + srcAppId + "/copy", httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id + '/publish?stream=' + testStream.id, httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id, httpHeader, JSON.stringify({ ...pLoad, ...{ name: "6 owner of target" } }));
                        $('#dbhubtest_output').append('*');
                        testApp = await functions.qrsCall('POST', config.qrsUrl + "app/" + srcAppId + "/copy", httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id + '/publish?stream=' + testStream.id, httpHeader);
                        await functions.qrsCall('PUT', config.qrsUrl + 'app/' + testApp.id, httpHeader, JSON.stringify({ ...pLoad, ...{ name: "7 default", owner: { id: user } } }));
                    }
                    $('#dbhubtest_output').append('<br>');
                }
                $('#dbhubtest_output').append('Done.');
                $('#cleardropzone').trigger('click');
            } else {
                functions.luiDialog('testhint', 'Test', 'Drag &amp; drop a source app to start tests', null, 'Cancel', false);
            }
        });

        $('#set_testapp_notowned').on('click', async function () {
            if ($('.draggedicon').length == 0) {
                functions.luiDialog('testhint', 'Test', 'Drag &amp; drop a source app to start tests', null, 'Cancel', false);
            } else if ($('#draggedapp_owner').text() == thisUser) {
                functions.luiDialog('testhint', 'Test', 'You are the owner of the currently dragged source app. Choose one you don\'t own.', null, 'Cancel', false);
            } else {
                const srcAppId = $('#draggedapp_id').text();

                var trgtApp;
                functions.luiDialog('testcard', 'Test Card', 'Here are your tests:<br>', null, 'Cancel', false);
                var tests = [
                    { name: '1 default', options: 'importscript' },
                    { name: '1 owner of target', options: 'importscript' },
                    { name: '2 default', options: 'importdata' }
                ];
                for (var i = 0; i < tests.length; i++) {
                    var currTest = tests[i];
                    trgtApp = await functions.qrsCall('GET', config.qrsUrl + "app?filter=stream.name eq 'databridge test n.owner' and name eq '" + currTest.name + "'", httpHeader);
                    if (trgtApp.length != 1) return alert('app not found')
                    $('#msgparent_testcard .lui-dialog__body').append('<a href="' + location.origin + location.pathname
                        + '?from=' + srcAppId + '&app=' + trgtApp[0].id + '&' + currTest.options + '" target="_blank">Test &quot;'
                        + currTest.name + '&quot</a> (' + currTest.options + ')<br>');
                };
            }
        });

        $('#set_testapp_owned').on('click', async function () {
            if ($('.draggedicon').length == 0) {
                functions.luiDialog('testhint', 'Test', 'Drag &amp; drop a source app to start tests', null, 'Cancel', false);
            } else if ($('#draggedapp_owner').text() != thisUser) {
                functions.luiDialog('testhint', 'Test', 'You are not the owner of the currently dragged source app', null, 'Cancel', false);
            } else {
                const srcAppId = $('#draggedapp_id').text();

                var trgtApp;
                functions.luiDialog('testcard', 'Test Card', 'Here are your tests:<br>', null, 'Cancel', false);
                var tests = [
                    { name: '1o default', options: 'importscript' },
                    { name: '1o owner of target', options: 'importscript' },
                    { name: '2o default', options: 'importdata' },
                    { name: '3 default', options: 'importscript&importdata' },
                    { name: '4 default', options: 'importdesign' },
                    { name: '4 owner of target', options: 'importdesign' },
                    { name: '5 default', options: 'importdesign&importscript' },
                    { name: '6 default', options: 'importdesign&importdata' },
                    { name: '6 owner of target', options: 'importdesign&importdata' },
                    { name: '7 default', options: 'importdesign&importdata&importscript' }
                ];
                for (var i = 0; i < tests.length; i++) {
                    var currTest = tests[i];
                    trgtApp = await functions.qrsCall('GET', config.qrsUrl + "app?filter=stream.name eq 'databridge test owner' and name eq '" + currTest.name + "'", httpHeader);
                    if (trgtApp.length != 1) return alert('app not found')
                    $('#msgparent_testcard .lui-dialog__body').append('<a href="' + location.origin + location.pathname
                        + '?from=' + srcAppId + '&app=' + trgtApp[0].id + '&' + currTest.options + '" target="_blank">Test &quot;'
                        + currTest.name + '&quot</a> (' + currTest.options + ')<br>');
                };
            }
        });
        // Handling of querystrings in url

        if (location.search.indexOf("from=") > -1 && usedQuery.indexOf('from') == -1) {
            usedQuery.push('from');
            const from = location.search.split('from=')[1].split('&')[0];
            console.log('found "from" param in url:', from);
            // Mimik the drag&drop of an app into the dropzone.
            functions.qrsCall('GET', config.qrsUrl + 'app/full?filter=id eq ' + from, httpHeader)
                .then(function (res) {
                    if (res.length == 1) {
                        $('#dropzone').hide();
                        //$('#uploadform2').hide();
                        $('#cleardropzone').show();
                        $('#startcopy').show();
                        $('#draggedapp_id').text(res[0].id);
                        $('#draggedapp_owner').text(res[0].owner.userDirectory + '\\' + res[0].owner.userId);
                        $('#draggedapp_stream').text(res[0].published ? res[0].stream.name : "unpublished");
						if (res[0].tags.length > 0) {
							$('#draggedapp_tags').parent().show();
							res[0].tags.forEach(function(tag){
								$('#draggedapp_tags').append('<span class="apptag_blue">' +tag.name + '</span>');
							});
						} else {
							$('#draggedapp_tags').parent().hide();
						}
                        $('#draggedappinfo').show();
                        $('#sourceapparea').append(loadapps.createAppIcon(
                            from, res[0].name, res[0].owner.userDirectory + '\\' + res[0].owner.userId, res[0].published ? res[0].stream.name : "unpublished"
                        ).replace(' id="', ' appid="').replace('draggable', ''));
                        $('[appid="' + from + '"]').addClass('draggedicon');
                        $('.draggedicon .lui-checkbox').remove();
                        if (res[0].thumbnail.length > 1) {
                            $('.draggedicon .thumb-hover').css('background-image', 'url(' + config.baseUrl + res[0].thumbnail + ')');
                            $('.draggedicon .mashup-image').remove();
                        }
                    } else {
                        functions.luiDialog('428', 'Error 428', 'No such app as in parameter "from" (' + from
                            + ')', null, 'Close', false);
                    }
                })
        }


        async function determineStream() {
            // 1.) if url has "app" querystring, get stream id from the app
            if (location.search.indexOf("app=") > -1) {
				console.log('found querystring "app"');
                const appFromUrl = location.search.split('app=')[1].split('&')[0];
                stream = 'mywork';
                if (guid_pattern.test(appFromUrl)) {
                    const appInfo = await functions.qrsCall('GET', config.qrsUrl + "app/full?filter=id eq " + appFromUrl, httpHeader);
                    if (appInfo.length > 0 && appInfo[0].published) {
                        stream = appInfo[0].stream.id
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
                const streamInfo = await functions.qrsCall('GET', config.qrsUrl + "stream?filter=name eq 'Everyone'", httpHeader);
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
                $('#select_stream').prepend('<option>-- choose stream --</option>');
            } else {
                loadapps.go(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
				
                $('#btn_loadapps').removeAttr('disabled');
                $('#btn_uploadnew').removeAttr('disabled');
            }
        }

    }
});
