// JavaScript
define(['./functions'], function (functions) {
    return {

        go: function (moreFilter, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery) {
            loadApps(moreFilter, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
        },

        createAppIcon: function (id, name, owner, stream) {
            return createAppIcon(id, name, owner, stream)
        }
    }

    function generateGUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function createAppIcon(id, name, owner, stream, tagList) {
        const ret = ''
            + '<li class="devhub-list-item" draggable="true" id="' + id + '" owner="' + owner + '" stream="' + stream + '"'
            + '   name="' + name + '" tags="' + tagList + '">'
            + '  <div class="list-icon" style="font-size:12px;">'
            + '      <div class="thumb-hover">'
            + '        <label class="lui-checkbox">'
            + '           <input class="lui-checkbox__input" type="checkbox" /><div class="lui-checkbox__check-wrap"><span class="lui-checkbox__check"></span></div>'
            + '        </label>'
            + '      </div>'
            + '      <div class="icon mashup-image"></div>'
            + '  </div>'
            + '  <div class="qui-list-text">'
            + '      <div class="text-title-wrap">'
            + '          <span class="text-title"'
            + '              title="' + name + '">' + name + '</span>'
            + '      </div>'
            + '      <div class="info-icon-wrap">'
            + '          <span class="lui-icon  lui-icon--info  info_' + id + '"></span>'
            + '      </div>'
            + '  </div>'
            + '</li>';
        return ret;
    }

    function loadApps(moreFilter, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery) {

        const filter = (stream == 'mywork' ?
            "published eq false and owner.userId eq '" + thisUser.split('\\')[1] + "' and owner.userDirectory eq '" + thisUser.split('\\')[0] + "'"
            : "stream.id eq " + stream
        );
        functions.qrsCall('GET', config.qrsUrl + "app/full?filter=" + filter
            + ($('#searchtxt').val() == "" ? '' : (" and " + $('#searchswitch option:selected').val() + " so '" + $('#searchtxt').val() + "'"))
            + '&orderBy=name', httpHeader)
            .then(function (appList) {
                $("#applist").empty();
                $('#appcounter').text('(' + appList.length + ')');
                appList.forEach(function (app) {
                    var tagList = [];
                    app.tags.forEach(function (tag) { tagList.push(tag.name); });
                    $("#applist").append(createAppIcon(
                        app.id,
                        app.name,
                        app.owner.userDirectory + '\\' + app.owner.userId,
                        app.published ? app.stream.name : 'unpublished',
                        tagList.join('|')
                    ));
                    // vertically center the title text (I haven't found a way to do that with plain css)
                    const offsetY = ($('#' + app.id + ' .text-title-wrap').height() - $('#' + app.id + ' .text-title').height()) / 2;
                    if (offsetY > 0) $('#' + app.id + ' .text-title-wrap').css('transform', 'translateY(' + offsetY + 'px)');
                    $('#' + app.id).on('dragstart', function (event) {
                        event.originalEvent.dataTransfer.setData('text', app.id);
                        console.log('dragging ' + app.id);

                    });
                    $('.info_' + app.id).on('mouseover', async function () {

                        $('#qs-page-container').append(forms['hoverinfo.html']
                            .replace('{{app.id}}', app.id)
                            .replace('{{app.name}}', app.name)
                            .replace('{{owner}}', app.owner.userDirectory + '\\' + app.owner.userId)
                            .replace('{{created}}', app.createdDate.split('.')[0].replace('T', ' '))
                        ); /*'<div id="div_moreinfo" class="lui-tooltip  apphoverinfo" style="width: 300px;word-break: break-all;">'
                            + '<b>Name: </b>' + app.name + '<br/>'
                            + '<b>Id: </b>' + app.id + '<br/>'
                            + '<b>Owner: </b>' + app.owner.userDirectory + '\\' + app.owner.userId + '<br/>'
                            + '<b>Created </b>' + app.createdDate.split('.')[0].replace('T', ' ') + '<br/>'
                            + '<b>Published </b><span id="span_publishedat">...</span><br/>'
                            + '<b>Reloaded </b><span id="span_reloadedat">...</span><br/>'
                            //+ '<b>Datamodel Hash: </b><span id="span_dmhash">...</span><br/>'
                            + '<b>Script Hash: </b><span id="span_scripthash">...</span>'
                            + '<div class="lui-tooltip__arrow lui-tooltip__arrow--top"></div></div>');
                        */
                        const pos = $('#' + app.id).offset();
                        $('#div_moreinfo').css('top', pos.top + 100);
                        $('#div_moreinfo').css('left', pos.left - 30);
                        const adHocInfo = await functions.qrsCall('GET', config.qrsUrl + 'app/' + app.id, httpHeader);
                        $('#span_publishedat').text(adHocInfo.publishTime.split('.')[0].replace('T', ' '));
                        $('#span_reloadedat').text(adHocInfo.lastReloadTime.split('.')[0].replace('T', ' '));
                        $('#span_tags').empty();
                        adHocInfo.tags.forEach(function (tag) {
                            $('#span_tags').append('<span class="apptag">&nbsp;' + tag.name + "&nbsp;</span>");
                        });
                        if (adHocInfo.tags.length == 0) $('#span_tags').parent().remove();
                        const adHocScriptInfo = await functions.qrsCall('GET', config.qrsUrl + 'app/object?filter=app.id eq '
                            + app.id + " and objectType eq 'app_appscript'", httpHeader);
                        $('#span_scripthash').text(adHocScriptInfo[0].contentHash);
                        //const adHocDMInfo = await functions.qrsCall('GET', config.qrsUrl + 'app/object?filter=app.id eq '
                        //    + app.id + " and objectType eq 'loadModel'", httpHeader);
                        //$('#span_dmhash').text(adHocDMInfo[0].contentHash);
                    });
                    $('.info_' + app.id).on('mouseout', function () {
                        $('.apphoverinfo').remove();
                    });

                    if (app.thumbnail.length > 1) {
                        $('#' + app.id + ' .thumb-hover').css('background-image', 'url(' + config.baseUrl + app.thumbnail + ')');
                        $('#' + app.id + ' .mashup-image').remove();
                        //  $("#" + app.id).find('.list-icon').html('<img src="'
                        //      + config.baseUrl + app.thumbnail + '" style="width:164px;height:109px;" />');

                    }

                    // get the sheet id's for each app
                    $('#' + app.id + ' .qui-list-text').on('click', async function () {
                        contextmenu(app, enigma, schema, config, settings, httpHeader, thisUser, forms, stream, usedQuery)
                    });
                })


            })
            .finally(function () {
                // querystrings controlled opening of context menu
                if (location.search.indexOf("app=") > -1 && usedQuery.indexOf('app') == -1) {
                    const queryAppId = location.search.split('app=')[1].split('&')[0];
                    if ($('#' + queryAppId).length > 0) {
                        console.log('found "app" param in url:' + queryAppId);
                        //$('#' + queryAppId + ' .qui-list-text').trigger('click');
                        $('#' + queryAppId + ' .lui-checkbox__input').attr('checked', 'checked');
                        if ($('.draggedicon').length > 0) $('#startcopy').trigger('click');
                        usedQuery.push('app');
                    }
                }
            })
            .catch(function (error) {
                functions.luiDialog('137', 'Error 137', JSON.stringify(error), null, 'Close', false);
            });
    }

    function createSingleLink(appid, sheetid, config) {
        return config.baseUrl + '/single?appid=' + appid + '&sheet=' + sheetid + '&opt=currsel,ctxmenu';
    }

    function contextmenu(app, enigma, schema, config, settings, httpHeader, thisUser, forms, stream, usedQuery) {


        // ----------- CONTEXT MENU ----------- 

        functions.luiDialog('contextmenu', '<span>' + app.name + '</span>&nbsp;<span id="editname" class="lui-icon  lui-icon--small lui-icon--edit"></span>'
            , forms['menu.html'], null, 'Close', false, 500);
        if (!settings.isQapLicense) $('#msgparent_contextmenu .lui-dialog__title')
            .append('<a href="../../sense/app/' + app.id + '" class="lui-button" target="_blank" style="float:right;">Open App</a>')

        $('#input_appname').val(app.name);
        $('#appowner').text(app.owner.userDirectory + '\\' + app.owner.userId);
        $('#appstream').text(app.published ? app.stream.name : 'not published');
        app.tags.forEach(function (tag) {
            $('#apptags').append('<span class="apptag">&nbsp;' + tag.name + "&nbsp;</span>");
        });
        $('#appid').text(app.id);
        if (thisUser != (app.owner.userDirectory + '\\' + app.owner.userId)) {
            $('#btn_makemeowner').show();
            $('#btn_showscript button').on('click', async function () {
                $('#spinningwheel').show();
                $('#contextmenu').hide();
                // The current user is not the owner of the app, so he won't see the script. We temporarily create a copy of the app.
                const newApp = await functions.qrsCall('POST', config.qrsUrl + 'app/' + app.id + '/copy', httpHeader);
                functions.showScript(enigma, schema, config, newApp, true, httpHeader);

            });
            $('#btn_setscript button').on('click', function () {
                functions.luiDialog('err', 'Error', 'You are not the owner of the app. You may not change the script.', null, 'OK', true);
            });
        } else {
            // user is the owner of the current app
            //$('#btn_showscript').show(); 
            //$('#owneractions').show();
            $('#btn_showscript').click(async function () {
                functions.showScript(enigma, schema, config, app)
            });
            $('#btn_setscript').click(async function () {
                functions.setScript(enigma, schema, config, app, forms);
            });
        }

        functions.qrsCall('GET', config.qrsUrl + "app/object?filter=objectType eq 'sheet' and app.id eq " + app.id, httpHeader)
            .then(function (sheetList) {
                $('#sheetcounter').text(sheetList.length);
                sheetList.forEach(function (sheet, i) {
                    //console.log(sheet);
                    $('#sheetlist').append('<option value="' + sheet.engineObjectId + '">' + sheet.name + '</option>');
                    if (i == 0) {
                        // arm the first available sheet to the button href
                        $("#opensheet").attr("href", createSingleLink(app.id, sheet.engineObjectId, config));
                    }
                });
                $("#sheetlist").change(function () {
                    $("#opensheet").attr("href", createSingleLink(app.id, $('#sheetlist').find(":selected").val(), config));
                    //.attr("disabled", $('#sheetlist').find(":selected").val() == "");
                });
            })


        $('#btn_makemeowner button').on('click', function () {
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
                loadApps(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
            })
        });

        $('#btn_duplicate button').on('click', function () {
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
                loadApps(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
            })
        });

        $('#btn_deleteapp button').on('click', function () {
            functions.luiDialog('confirm', 'Confirm Deletion', 'Are you sure to delete the app permanently?', 'Delete', 'Cancel', false);
            $('#msgok_confirm').click(async function () {
                $('#msgparent_confirm').remove();
                $('#spinningwheel').show();
                $('#contextmenu').hide();
                const ret = await functions.qrsCall('DELETE', config.qrsUrl + 'app/' + app.id, httpHeader);
                $('#msgparent_contextmenu').remove();
                loadApps(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
            })
        });

        $('#btn_exportapp button').on('click', function () {
            $('#contextmenu').hide();
            $('#spinningwheel').show();
            const randGUID = generateGUID();
            functions.qrsCall('POST', config.qrsUrl + "app/" + app.id + "/export/" + randGUID + "?exportScope=all", httpHeader)
                .then(function (expAppInfo) {
                    console.log('You can get the exported app:', expAppInfo);

                    $('#msgparent_contextmenu').remove();

                    functions.luiDialog('confirm', 'Export ready',
                        `Click <a href="${expAppInfo.downloadPath}&exportToken=${expAppInfo.exportToken}">here to download</a> the app.`
                        + `<hr/>`
                        + `Here is an <u id="downloadmeta">object report</u> of private/commmunity objects`,
                        null, 'Close', false);

                    $('#downloadmeta').click(function () {
                        functions.qrsCall('GET', config.qrsUrl + "app/object/full?filter=app.id eq " + app.id + " and approved eq false"
                            , httpHeader).then(function (appObjectList) {
                                console.log('appObjectList', appObjectList);
                                const data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appObjectList));
                                var link = document.createElement('a');
                                link.setAttribute('href', data);
                                link.setAttribute('download', app.name + '.json');
                                link.click();
                            })

                    })

                })
        });

        $('#btn_objectlist button').on('click', function () {

            const orderBy = 'app.name,objectType';

            function renderTable(appObjectList, justThisApp) {
                var ret = {
                    count: 0,
                    tableHtml: `
                        <table id="aob-table">
                        <thead>
                        <tr>
                            <th>app</th>
                            <th>obj id</th>
                            <th>obj name</th>
                            <th>obj type</th>
                            <th>owner</th>
                            <th>scope</th>
                            <th>action</th>
                        </tr>
                        </thead>
                        <tbody>`,

                    filterHtml: `
                        <table><thead><tr>
                            <th>app</th><th>object type</th><th>owner</th><th>base/comm./priv.</th>
                        </tr></thead><tbody><tr>
                        <td><select class="lui-select  lui-select--gradient" id="select-app">
                            <option value="app.stream.id eq ${app.stream.id}">-apps in stream-</option>
                            <option value="app.id eq ${app.id}" selected>${app.name}</option>
                            <!--apps-->
                        </select></td>
                        <td><select class="lui-select  lui-select--gradient" id="select-objtype">
                            <option selected>-all-</option>
                            <!--objtypes-->
                        </select></td>
                        <td><select class="lui-select  lui-select--gradient" id="select-owner">
                            <option selected>-all-</option>
                            <!--owners-->
                        </select></td>
                        <td><select class="lui-select  lui-select--gradient" id="select-scope">
                            <option selected>-all-</option>
                            <option>base</option>
                            <option>community</option>
                            <option>private</option>
                        </select></td>
                        <td>
                        <button class="lui-button" id="btn-apply-filter">Set filter</button>
                        <div id="aob-counter"></div>
                        </td></tr>
                        </tbody></table>`
                }
                var owners = [];
                var objtypes = [];
                var apps = [];
                $('#applist .devhub-list-item').each(function (i, e) {
                    if ($(e).attr('id') != app.id) {
                        apps.push(`<option value="app.id eq ${$(e).attr('id')}">${$(e).attr('name')}</option>`)
                    }
                })
                ret.filterHtml = ret.filterHtml.replace('<!--apps-->', apps.join(''));

                for (var i = 0; i < appObjectList.length; i++) {
                    const appObject = appObjectList[i];
                    const scope = appObject.approved ? 'base' : (appObject.published ? 'community' : 'private');
                    if (owners.indexOf(appObject.owner.userId) == -1) owners.push(appObject.owner.userId);
                    if (objtypes.indexOf(appObject.objectType) == -1) objtypes.push(appObject.objectType);
                    if (justThisApp ? (appObject.app.id == justThisApp) : true) {
                        ret.count++;
                        ret.tableHtml += `<tr class="aob-scope-${scope} aob-scope-all" id="aob-tr-${appObject.id}">
                            <td title="${appObject.app.name}">${appObject.app.name}</td>
                            <td title="${appObject.id}">${appObject.id}</td>
                            <td title="${appObject.name}">${appObject.name}</td>
                            <td>${appObject.objectType}</td>
                            <td>${appObject.owner.userDirectory}\\${appObject.owner.userId}</td>
                            <td id="scope-${appObject.id}">${scope}</td>
                            <td>
                                <button class="btn-approve" id="btn-approve-${appObject.id}" style="${scope == 'community' ? '' : 'display:none;'};">approve</button>
                                <button class="btn-unapprove" id="btn-unapprove-${appObject.id}" style="${scope == 'base' ? '' : 'display:none;'};">unapprove</button>
                                <button class="btn-publish" id="btn-publish-${appObject.id}" style="${scope == 'private' ? '' : 'display:none;'};">publish</button>
                                <button class="btn-unpublish" id="btn-unpublish-${appObject.id}" style="${scope == 'community' ? '' : 'display:none;'};">unpublish</button>
                            </td>
                        </tr>`
                    }
                };
                ret.tableHtml += `</table></tbody>`;
                ret.filterHtml = ret.filterHtml.replace('<!--owners-->',
                    owners.map(i => `<option>${i}</option>`).join(''));
                ret.filterHtml = ret.filterHtml.replace('<!--objtypes-->',
                    objtypes.map(i => `<option>${i}</option>`).join(''));

                return ret
            }

            function rowButtonEvents() {
                $('.btn-approve').click(function (e) {
                    const id = $(e.currentTarget).attr('id').split('-approve-')[1];
                    console.log('approve clicked', id);
                    const body = JSON.stringify({ modifiedDate: "2099-12-31T14:53:45.908Z", approved: true });
                    functions.qrsCall('PUT', `${config.qrsUrl}app/object/${id}`, httpHeader, body)
                        .then(function (appObject) {
                            if (appObject) {
                                $(`#btn-unapprove-${id}`).show();
                                $(`#btn-approve-${id}`).hide();
                                $(`#btn-publish-${id}`).hide();
                                $(`#btn-unpublish-${id}`).hide();
                                $(`#scope-${id}`).text('base');
                                $(`#aob-tr-${id}`).removeClass('aob-scope-community').addClass('aob-scope-base');
                            }
                        })
                })
                $('.btn-unapprove').click(function (e) {
                    const id = $(e.currentTarget).attr('id').split('-unapprove-')[1];
                    console.log('unapprove clicked', id);
                    const body = JSON.stringify({ modifiedDate: "2099-12-31T14:53:45.908Z", approved: false });
                    functions.qrsCall('PUT', `${config.qrsUrl}app/object/${id}`, httpHeader, body)
                        .then(function (appObject) {
                            if (appObject) {
                                $(`#btn-unapprove-${id}`).hide();
                                $(`#btn-approve-${id}`).show();
                                $(`#btn-publish-${id}`).hide();
                                $(`#btn-unpublish-${id}`).show();
                                $(`#scope-${id}`).text('community');
                                $(`#aob-tr-${id}`).removeClass('aob-scope-base').addClass('aob-scope-community');
                            }
                        })
                })
                $('.btn-publish').click(function (e) {
                    const id = $(e.currentTarget).attr('id').split('-publish-')[1];
                    console.log('publish clicked', id);
                    const body = JSON.stringify({ modifiedDate: "2099-12-31T14:53:45.908Z" });
                    functions.qrsCall('PUT', `${config.qrsUrl}app/object/${id}/publish`, httpHeader, body)
                        .then(function (appObject) {
                            if (appObject) {
                                $(`#btn-unapprove-${id}`).hide();
                                $(`#btn-approve-${id}`).show();
                                $(`#btn-publish-${id}`).hide();
                                $(`#btn-unpublish-${id}`).show();
                                $(`#scope-${id}`).text('community');
                                $(`#aob-tr-${id}`).removeClass('aob-scope-private').addClass('aob-scope-community');
                            }
                        })
                })
                $('.btn-unpublish').click(function (e) {
                    const id = $(e.currentTarget).attr('id').split('-unpublish-')[1];
                    console.log('unpublish clicked', id);
                    const body = JSON.stringify({ modifiedDate: "2099-12-31T14:53:45.908Z" });
                    functions.qrsCall('PUT', `${config.qrsUrl}app/object/${id}/unpublish`, httpHeader, body)
                        .then(function (appObject) {
                            if (appObject) {
                                $(`#btn-unapprove-${id}`).hide();
                                $(`#btn-approve-${id}`).hide();
                                $(`#btn-publish-${id}`).show();
                                $(`#btn-unpublish-${id}`).hide();
                                $(`#scope-${id}`).text('private');
                                $(`#aob-tr-${id}`).removeClass('aob-scope-community').addClass('aob-scope-private');
                            }
                        })
                })
            }

            $('#contextmenu').hide();
            $('#spinningwheel').show();
            functions.qrsCall('GET', `${config.qrsUrl}app/object/full?filter=app.stream.id eq ${app.stream.id}&orderBy=${orderBy}`, httpHeader)
                .then(function (appObjectList) {
                    $('#msgparent_contextmenu').remove();

                    var html = renderTable(appObjectList, app.id);

                    functions.luiDialog('list', 'App objects found', `
                        <div class="aob-filter-btns">${html.filterHtml}</div>
                        <div id="spinningwheel2" style="display:none;"></div>
                        <div style="overflow-y:auto; height:${window.screen.height / 2}px;">
                            ${html.tableHtml}
                        </div>`
                        , null, 'Close', false);

                    $('.lui-dialog').animate({ width: '85%' });
                    $('#aob-counter').text(html.count);
                    rowButtonEvents();

                    $('#btn-apply-filter').click(function () {
                        $('#btn-apply-filter').prop('disabled', true);
                        $('#spinningwheel2').show();
                        $('#aob-table').hide();
                        // build a new filter querystring for the next QRS API call
                        filters = [$('#select-app').val()];
                        if ($('#select-owner option:selected').text() != '-all-') {
                            filters.push(`owner.userId eq '${$('#select-owner option:selected').text()}'`);
                        }

                        if ($('#select-objtype option:selected').text() != '-all-') {
                            filters.push(`objectType eq '${$('#select-objtype option:selected').text()}'`);
                        }

                        if ($('#select-scope option:selected').text() == 'base') {
                            filters.push('published eq true and approved eq true');
                        } else if ($('#select-scope option:selected').text() == 'private') {
                            filters.push('published eq false and approved eq false');
                        } else if ($('#select-scope option:selected').text() == 'community') {
                            filters.push('published eq true and approved eq false');
                        }

                        functions.qrsCall('GET', `${config.qrsUrl}app/object/full?filter=${filters.join(' and ')}&orderBy=${orderBy}`, httpHeader)
                            .then(function (appObjectList) {
                                $('#btn-apply-filter').prop('disabled', false);
                                $('#spinningwheel2').hide();
                                const html = renderTable(appObjectList);
                                $('#aob-table').replaceWith(html.tableHtml).show();;
                                $('#aob-counter').text(html.count);
                                rowButtonEvents();
                            })

                    })


                })
        });
        $('#btn_showdatamodel button').on('click', async function () {
            functions.showDataModel(enigma, schema, config, app, httpHeader)
        });

        $('#btn_reload button').on('click', function () {

            functions.luiDialog('confirm', 'Confirm Reload', "Trigger ad-hoc reload in background?", 'Reload', 'Cancel', false);
            $('#msgok_confirm').click(async function () {
                //const ret = await functions.qrsCall('POST', config.qrsUrl + 'app/' + app.id + '/reload', httpHeader);
                $('#msgparent_confirm').remove();
                $('#msgparent_contextmenu').remove();
                functions.reloadApp(app.id, config, httpHeader);
            })
        });

        $('.btn_back').on('click', async function () {
            $('#contextmenu').show();
            $('#div_editname').hide();
            $('#div_editstream').hide();
            $('#div_edittags').hide();
            $('#div_editowner').hide();
        });

        //$('#btn_editname button').on('click', async function () {
        $('#editname').on('click', async function () {
            $('#contextmenu').hide();
            $('#div_editname').show();
            $('#input_appname').focus();
        });

        $('#btn_saveappname').on('click', async function () {
            const chgApp = await functions.qrsCall('PUT', config.qrsUrl + 'app/' + app.id, httpHeader, JSON.stringify({
                name: $("#input_appname").val(),
                modifiedDate: "2199-12-31T23:59:59.999Z"
            }));
            $('#msgparent_contextmenu').remove();
            loadApps(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
        });

        $('#editstream').on('click', async function () {
            $('#contextmenu').hide();
            $('#div_editstream').show();
            if (app.published) {
                $('#btn_unpublish').show();
                $('#btn_savestream').show();
            }
            if (!app.published) $('#btn_publish').show();

            const streams = await functions.qrsCall('GET', config.qrsUrl + 'stream?orderBy=name', httpHeader);
            streams.forEach(function (stream) {
                $('#streamlist').append('<option value="' + stream.id + '"' +
                    (app.published && stream.id == app.stream.id ? ' selected' : '') + '>' + stream.name + '</option>');
            });
        });

        var removeTags;
        var addTags;
        $('#edittags').on('click', async function () {
            $('#contextmenu').hide();
            $('#div_edittags').show();
            removeTags = [];
            addTags = [];
            $('#curr-taglist').empty();
            app.tags.forEach(function (tag) {
                $('#curr-taglist').append('<span class="apptag" style="" id="' + tag.id + '">'
                    + tag.name + '&nbsp;<span class="lui-icon  lui-icon--remove" id="rem_' + tag.id + '"></span></span>');
                $('#rem_' + tag.id).on('click', function () {
                    if (removeTags.indexOf(tag.id) == -1) removeTags.push(tag.id);
                    $('#' + tag.id).remove();
                    console.log('addtags' + JSON.stringify(addTags));
                    console.log('removetags' + JSON.stringify(removeTags));
                })
            });

            const alltags = await functions.qrsCall('GET', config.qrsUrl + 'tag?orderBy=name', httpHeader);
            $('#newtaglist').empty();
            alltags.forEach(function (tag) {
                $('#newtaglist').append('<option value="' + tag.name + '" />');
            });
        });

        function addTagToForm(tagObj) {
            $('#curr-taglist').append('<span class="apptag" style="background-color:#b5f07c;" id="' + tagObj.id + '">'
                + tagObj.name + '&nbsp;<span class="lui-icon  lui-icon--remove" id="unlist_' + tagObj.id + '"></span></span>');
            if (addTags.indexOf(tagObj.id) == -1) addTags.push(tagObj.id);
            $('#newtag').val('');
            console.log('addtags' + JSON.stringify(addTags));
            console.log('removetags' + JSON.stringify(removeTags));
            $('#unlist_' + tagObj.id).on('click', function () {
                addTags = addTags.filter(function (e) { return e != tagObj.id })
                $('#' + tagObj.id).remove();
                console.log('addtags' + JSON.stringify(addTags));
                console.log('removetags' + JSON.stringify(removeTags));
            })
        }

        $('#btn_addtag').on('click', async function () {
            const newtag = $('#newtag').val();
            if (newtag != "") {
                var tagIds = await functions.qrsCall('GET', config.qrsUrl + "tag?filter=name eq '" + newtag + "'", httpHeader);
                if (tagIds.length == 0) {
                    functions.luiDialog('327', 'Confirm', "Tag '" + newtag + "' doesn't exist. Create it?", 'Yes', 'No', false);
                    $('#msgok_327').on('click', async function () {
                        $('#msgparent_327').remove();
                        const tagId = await functions.qrsCall('POST', config.qrsUrl + "tag", httpHeader, JSON.stringify({
                            name: newtag
                        }));
                        addTagToForm(tagId);
                    })
                } else {
                    addTagToForm(tagIds[0]);
                }
            }
        })

        $('#btn_savetags').on('click', async function () {
            $('#div_edittags').hide();
            $('#spinningwheel').show();
            var newAppTags = [];
            app.tags.forEach(function (appTag) {
                if (removeTags.indexOf(appTag.id) == -1) newAppTags.push({ id: appTag.id });
            });
            addTags.forEach(function (addTag) {
                newAppTags.push({ id: addTag })
            });
            console.log('old app tags:', app.tags);
            console.log('new app tags:', newAppTags);

            const chgApp = await functions.qrsCall('PUT', config.qrsUrl + 'app/' + app.id, httpHeader, JSON.stringify({
                tags: newAppTags,
                modifiedDate: "2199-12-31T23:59:59.999Z"
            }));
            $('#msgparent_contextmenu').remove();
            loadApps(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
        });

        $('#btn_savestream').on('click', async function () {
            $('#div_editstream').hide();
            $('#spinningwheel').show();
            const streamId = $("#streamlist").val();
            const streamName = $('#streamlist').find(':selected').text();
            const chgApp = await functions.qrsCall('PUT', config.qrsUrl + 'app/' + app.id, httpHeader, JSON.stringify({
                stream: { id: streamId },
                modifiedDate: "2199-12-31T23:59:59.999Z"
            }));
            $('#msgparent_contextmenu').remove();
            functions.luiDialog('304', 'Info', 'App is now in stream "' + streamName + '"', 'Go to stream', 'Close', false);
            loadApps(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
            $('#msgok_304').on('click', function () {
                location.href = location.origin + location.pathname + '?stream=' + streamId;
            })
        });

        $('#btn_publish').on('click', async function () {
            $('#div_editstream').hide();
            $('#spinningwheel').show();
            const streamId = $("#streamlist").val();
            const streamName = $('#streamlist').find(':selected').text();
            const chgApp = await functions.qrsCall('PUT', config.qrsUrl + 'app/' + app.id + '/publish?stream='
                + streamId, httpHeader);
            $('#msgparent_contextmenu').remove();
            functions.luiDialog('313', 'Info', 'App is now in stream "' + streamName + '"', 'Open Stream', 'Close', false);
            loadApps(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
            $('#msgok_313').on('click', function () {
                location.href = location.origin + location.pathname + '?stream=' + streamId;
            })
        });


        $('#btn_unpublish').on('click', async function () {
            functions.luiDialog('409', 'Confirm', 'Really want to move app from stream into "My Work"?', 'Yes', 'No', false);
            $('#msgok_409').on('click', async function () {
                $('#msgparent_409').remove();
                $('#div_editstream').hide();
                $('#spinningwheel').show();
                const newStream = await functions.qrsCall('POST', config.qrsUrl + 'stream', httpHeader, JSON.stringify({
                    name: 'temporary stream of databridge hub'
                }));
                const chgApp = await functions.qrsCall('PUT', config.qrsUrl + 'app/' + app.id, httpHeader, JSON.stringify({
                    stream: { id: newStream.id },
                    modifiedDate: "2199-12-31T23:59:59.999Z"
                }));
                await functions.qrsCall('DELETE', config.qrsUrl + 'stream/' + newStream.id, httpHeader);
                $('#msgparent_contextmenu').remove();
                functions.luiDialog('330', 'Info', 'App is now in stream "My Work"', 'Open My Work', 'Close', false);
                loadApps(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
                $('#msgok_330').on('click', function () {
                    location.href = location.origin + location.pathname + '?stream=mywork';
                })
            })
        });

        // Edit owner form and actions

        $('#editowner').on('click', async function () {
            $('#contextmenu').hide();
            $('#div_editowner').show();

            if (!app.published) $('#ownerchg_warning').show();

            const users = await functions.qrsCall('GET', config.qrsUrl + 'user?orderBy=name', httpHeader);
            users.forEach(function (user) {
                $('#userlist').append('<option value="' + user.userDirectory + '\\' + user.userId + '" />');
            });
        });

        $('#btn_saveowner').on('click', async function () {
            if ($('#user').val().indexOf('\\') > 1) {
                $('#div_editowner').hide();
                $('#spinningwheel').show();
                const userDir_id = $('#user').val().split('\\')
                const user = await functions.qrsCall('GET', config.qrsUrl + "user?filter=userId eq '" + userDir_id[1]
                    + "' and userDirectory eq '" + userDir_id[0] + "'", httpHeader);
                if (user.length == 1) {
                    const chgApp = await functions.qrsCall('PUT', config.qrsUrl + 'app/' + app.id, httpHeader, JSON.stringify({
                        owner: { id: user[0].id },
                        modifiedDate: "2199-12-31T23:59:59.999Z"
                    }));
                    $('#msgparent_contextmenu').remove();
                    functions.luiDialog('446', 'Info', 'App is now owned by ' + userDir_id.join('\\') + '.', null, 'Close', false);
                    loadApps(null, thisUser, config, httpHeader, enigma, schema, settings, thisUser, forms, stream, usedQuery);
                } else {
                    functions.luiDialog('448', 'Error', 'Invalid user entered.', null, 'Close', false);
                }
            }
        });
    }
});
