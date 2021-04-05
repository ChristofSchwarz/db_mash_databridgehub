// JavaScript
define([], function () {
    const logQrsCommunication = true;  // printing to console.log any http request and response
    return {
        // settings for QRS API access via a header-authenticated virtual proxy

        //=============================================================================================
        luiDialog: function (ownId, title, detail, ok, cancel, inverse) {
            luiDialog(ownId, title, detail, ok, cancel, inverse);
        },


        createAppIcon: function (id, name) {
            const ret = ''
                + '<li class="devhub-list-item" id="' + id + '">'
                + '  <div class="list-icon">'
                + '      <div class="thumb-hover"></div>'
                + '      <div class="icon mashup-image"></div>'
                + '  </div>'
                + '  <div class="qui-list-text">'
                + '      <div class="text-title-wrap">'
                + '          <span class="text-title"'
                + '              title="' + name + '">' + name + '</span>'
                + '      </div>'
                + '      <div class="info-icon-wrap">'
                + '          <span class="lui-icon  lui-icon--info" id="info_' + id + '"></span>'
                + '      </div>'
                + '  </div>'
                + '</li>';
            return ret;
        },

        uploadApp: async function (file, config, httpHeader) {
            console.log('uploading file', file, httpHeader);
            const xrfKey = httpHeader["X-Qlik-Xrfkey"];
            //newXrfKey();
            const ret = await $.ajax({
                url: config.qrsUrl + "app/upload?name=" + file.name.split('.qvf')[0] + '&keepData=true&xrfkey=' + xrfKey,
                type: "POST",
                data: file,
                contentType: 'application/vnd.qlik.sense.app',
                processData: false,
                headers: httpHeader,
                /*success: function (response) {
                    if (response != 0) {
                        alert('File uploaded');
                    } else {
                        alert('file not uploaded');
                    }
                }*/
            });
            //console.log('result of upload:', ret);
            return ret
        },

        showScript: async function (enigma, schema, config, app) {
            $('#spinningwheel').show();
            $('#contextmenu').hide();

            const session = enigma.create({
                schema,
                url: config.wssUrl + app.id,
                createSocket: url => new WebSocket(url)
            })

            const global = await session.open();
            const enigmaApp = await global.openDoc(app.id);
            var script = await enigmaApp.getScript();
            $('.work-area').append('<div id="scriptviewer">' +
                '<button class="lui-button" onclick="$(\'#scriptviewer\').remove();">Close</button>' +
                '<textarea></textarea></div>');
            $('#scriptviewer textarea').text(script);

            /*var wnd = window.open("about:blank", "", "_blank");
            wnd.document.write('<html><head></head>'
                + '<body style="font-family:monospace;">'
                + script.replace(/\n/g, '<br/>').replace(/\/\/\/\$tab/g, '<hr/>///$tab')
                + '</body></html>');
            */
            await session.close();
            $('#spinningwheel').hide();
            $('#contextmenu').show();
            $('#msgparent_contextmenu').remove();
        },


        showDataModel: async function (enigma, schema, config, app, httpHeader) {
            $('#spinningwheel').show();
            $('#contextmenu').hide();


            const session = enigma.create({
                schema,
                url: config.wssUrl + app.id,
                createSocket: url => new WebSocket(url)
            })

            const global = await session.open();
            const enigmaApp = await global.openDoc(app.id);
            const dataModel = await enigmaApp.evaluate("=Concat(DISTINCT '<td>' & $Table & '</td><td>' & $Rows & '</td><td>' & $Fields & '</td>', '</tr><tr>') & '</tr>"
                + "<tr><td></td><td>' & Sum($Rows) & '</td><td>' & Count(DISTINCT $Field) & '</td>'");
            //const hash = await enigmaApp.evaluate("=Hash256(Concat($Table & $Field & $Rows))");
            await session.close();
            const hash = await qrsCall('GET', config.qrsUrl + 'app/object?filter=app.id eq '
                + app.id + " and objectType eq 'loadModel'", httpHeader);
            $('#spinningwheel').hide();
            $('#table_datamodel').append('<tr><td>Table</td><td>Rows</td><td>Fields</td></tr><tr>' + dataModel + '</tr>');
            $('#span_hash').text(hash[0].contentHash);
            $('#div_datamodel').show();

        },


        enableDisableButton: function () {
            if ($('#importdesign').is(':checked')
                || $('#importscript').is(':checked')
                || $('#importdata').is(':checked')
            ) {
                if ($('#refreshfrommyapp').hasClass("lui-button--info")
                    || $('#refreshfrompubapp').hasClass("lui-button--info")
                ) {
                    $('#btn_replace').attr("disabled", false);
                } else if ($('#refreshfromfile').hasClass("lui-button--info")
                    && $('#fileinput')[0].files.length > 0) {
                    $('#btn_replace').attr("disabled", false);
                } else if ($('#myappslist :selected').length == 1
                    && !$('#refreshfromfile').hasClass("lui-button--info")
                    && !$('#refreshfrommyapp').hasClass("lui-button--info")
                    && !$('#refreshfrompubapp').hasClass("lui-button--info")
                ) {
                    // if the myapplist has a guid instead of a list of app names (comes from "from=" querystring)
                    if ($('#myappslist :selected').html().match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)) {
                        $('#btn_replace').attr("disabled", false);
                    }
                } else {
                    $('#btn_replace').attr("disabled", true);
                }
            } else {
                $('#btn_replace').attr("disabled", true);
            }

            // enable or disable the "Next >" button
            if ($('#refreshfrommyapp').hasClass("lui-button--info")
                || $('#refreshfrompubapp').hasClass("lui-button--info")
            ) {
                $('#btn_next').attr("disabled", false);
            } else if ($('#refreshfromfile').hasClass("lui-button--info")
                && $('#fileinput')[0].files.length > 0) {
                $('#btn_next').attr("disabled", false);
            } else {
                $('#btn_next').attr("disabled", true);
            }
        },

        previewSteps: function (thisUser) {
            $('#btn_startcopy').attr("disabled", !$('#importdesign').is(':checked')
                && !$('#importscript').is(':checked') && !$('#importdata').is(':checked'));
            if ($('#importdesign').is(':checked')) $('#overwrite_design').show();
            else $('#overwrite_design').hide();
            if ($('#importscript').is(':checked')) $('#overwrite_script').show();
            else $('#overwrite_script').hide();
            if ($('#importdata').is(':checked')) $('#overwrite_data').show();
            else $('#overwrite_data').hide();
            $('#nobinaryerror').hide();

            if ($('#fromapp_id').text() == $('#toapp_id').text()) {
                $('#sameapperror').show();
                $('#btn_startcopy').attr('disabled',true);
            } 

            const importDesign = $('#importdesign').is(':checked');
            const importScript = $('#importscript').is(':checked');
            const importData = $('#importdata').is(':checked');
            const fromFile = $('#refreshfromfile').hasClass('lui-button--info');
            const origAppId = $('#fromapp_id').text()
            const userIsOwnerOfSrcApp = fromFile ? true : (thisUser == $('#fromapp_owner').text());
            const qrsTag = '<span class="tag-qrs"></span>';
            const enigmaTag = '<span class="tag-enigma"></span>';
            const binaryPossible = $('#dConnectionIcon').hasClass('lui-icon--tick');
            var binaryNeeded = false;

            // fill a href attribut to deeplink this combination
            const deeplink = location.href.substr(0, location.href.length - location.search.length)
                 + '?app=' + $('#toapp_id').text() + '&from=' + (fromFile ? 'file' : origAppId)
                 + (importDesign ? '&importdesign' : '')
                 + (importData ? '&importdata' : '')
                 + (importScript ? '&importscript' : '');
            $('#a_deeplink').attr('href', deeplink);
            // reset step texts and hide them
            for (var step = 1; step <= 8; step++) {
                $("#step" + step + " .steptext").text('');
                $("#step" + step).hide();
            }

            if (importDesign && !importData) {  // Combination 1/5
                //------------------------------------------------------------------------
                // Fill 6 step texts
                if (fromFile) {
                    $("#step1 .steptext").html('Upload file as temp app' + qrsTag);
                } else {
                    $("#step1 .steptext").html('Copy source app as temp app' + qrsTag);
                }
                $('#step1').show();
                if (importScript) {
                    $("#step2 .steptext").html("Remember temp app's script" + enigmaTag);
                } else {
                    $("#step2 .steptext").html('Get script of target app' + enigmaTag);
                }
                $('#step2').show();
                binaryNeeded = true;
                $("#step3 .steptext").html('Reload temp app BINARY from target app' + enigmaTag);
                $("#step3").show();
                if (importScript) {
                    $("#step4 .steptext").html("Revert temp app's script" + enigmaTag);
                } else {
                    $("#step4 .steptext").html("Set temp app's script to target app's script" + enigmaTag);
                }
                $("#step4").show();
                $("#step5 .steptext").html("Replace target app with temp app" + qrsTag);
                $("#step5").show();
                $("#step6 .steptext").html("Delete temp app" + qrsTag);
                $("#step6").show();
                //------------------------------------------------------------------------
            } else if (importDesign && importData && !importScript) { // Combination 2/5
                //------------------------------------------------------------------------
                if (fromFile) {
                    $("#step1 .steptext").html('Upload file as temp app' + qrsTag);
                } else {
                    $("#step1 .steptext").html('Copy source app as temp app' + qrsTag);
                }
                $('#step1').show();
                $("#step2 .steptext").html('Get script of target app' + enigmaTag);
                $('#step2').show();
                $("#step3 .steptext").html("Set temp app's script to target app's script" + enigmaTag);
                $("#step3").show();
                $("#step4 .steptext").html("Replace target app with temp app" + qrsTag);
                $("#step4").show();
                $("#step5 .steptext").html("Delete temp app" + qrsTag);
                $("#step5").show();
                //------------------------------------------------------------------------
            } else if (importDesign && importData && importScript) { // Combination 3/5
                //------------------------------------------------------------------------
                if (fromFile) {
                    $("#step1 .steptext").html('Upload file as temp app' + qrsTag);
                    $('#step1').show();
                }
                $("#step2 .steptext").html("Replace target app with temp app" + qrsTag);
                $("#step2").show();
                if (fromFile) {
                    $("#step3 .steptext").html("Delete temp app" + qrsTag);
                    $("#step3").show();
                }
                //------------------------------------------------------------------------
            } else if (!importDesign && importData) { // Combination 4/5
                //------------------------------------------------------------------------
                if (fromFile) {
                    $("#step1 .steptext").html('Upload file as temp source app' + qrsTag);
                    $('#step1').show();
                } else if (!userIsOwnerOfSrcApp) {
                    $("#step1 .steptext").html('Copy source app as temp app' + qrsTag);
                    $('#step1').show();
                }
                $("#step2 .steptext").html("Create copy of target app" + qrsTag);
                $("#step2").show();
                if (importScript) {
                    $("#step3 .steptext").html("Get source app's script" + enigmaTag);
                } else {
                    $("#step3 .steptext").html("Remember script of copied app" + enigmaTag);
                }
                $("#step3").show();
                binaryNeeded = true;
                $("#step4 .steptext").html('Reload copied app BINARY from source app' + enigmaTag);
                $("#step4").show();
                if (importScript) {
                    $("#step5 .steptext").html("Set copied app's script to source app's script" + enigmaTag);
                } else {
                    $("#step5 .steptext").html("Revert copied app's script" + enigmaTag);
                }
                $("#step5").show();
                $("#step6 .steptext").html("Replace target app with copied app" + qrsTag);
                $("#step6").show();
                $("#step7 .steptext").html("Delete copied app" + qrsTag);
                $("#step7").show();
                if (fromFile || !userIsOwnerOfSrcApp) {
                    $("#step8 .steptext").html('Delete temp app' + qrsTag);
                    $('#step8').show();
                }
                //------------------------------------------------------------------------                      
            } else if (!importDesign && !importData && importScript) { // Combination 5/5
                //------------------------------------------------------------------------
                if (fromFile) {
                    $("#step1 .steptext").html('Upload file as temp source app' + qrsTag);
                    $('#step1').show();
                } else if (!userIsOwnerOfSrcApp) {
                    $("#step1 .steptext").html('Copy source app as temp app' + qrsTag);
                    $('#step1').show();
                }
                $("#step2 .steptext").html("Get source app's script" + enigmaTag);
                $("#step2").show();
                $("#step3 .steptext").html("Set target app's script" + enigmaTag);
                $("#step3").show();
                if (fromFile || !userIsOwnerOfSrcApp) {
                    $("#step4 .steptext").html('Delete temp source app' + qrsTag);
                    $('#step4').show();
                }
            }

            if (binaryNeeded && !binaryPossible) {
                $('#nobinaryerror').show();
                $('#btn_startcopy').attr('disabled',true);
            } 
        },

        // =================================================================================================
        replaceApp: async function (enigma, schema, httpHeader, app, config, settings, thisUser) {
            // enigma .. handle to enigma API
            // schema .. schema for enigma
            // httpHeader .. header to be passed to QRS API calls
            // app .. currently clicked app (icon in hub)
            // config .. config parameters, urls to QRS API, Websockets, ...
            // settings .. content of settings.js
            // thisUser .. the current user as string "UserDirectory\UserId"

            try {
                const importDesign = $('#importdesign').is(':checked');
                const importScript = $('#importscript').is(':checked');
                const importData = $('#importdata').is(':checked');
                const fromFile = $('#refreshfromfile').hasClass('lui-button--info');
                const origAppId = $('#myappslist :selected').val();
                const ownerInfo = !fromFile ? await qrsCall('GET', config.qrsUrl + 'app/full?filter=id eq ' + origAppId, httpHeader) : {};
                //console.log('ownerInfo', ownerInfo);
                // if (ownerInfo.length == 0) {
                //     luiDialog('158', 'Error',
                //         'No such app with id ' + origAppId
                //         , null, 'Close', false);
                //     return 0;
                // }
                const userIsOwnerOfSrcApp = fromFile ? true : (thisUser == ownerInfo[0].owner.userDirectory + '\\' + ownerInfo[0].owner.userId);
                //console.log('Current user is the owner of source app?', userIsOwnerOfSrcApp);
                //const needTempCopy = (!fromFile && importData && importScript) ? false : true;
                const qrsTag = '<span class="tag-qrs"></span>';
                const enigmaTag = '<span class="tag-enigma"></span>';
                const binaryPossible = $('#dConnectionIcon').hasClass('lui-icon--tick');

                //----------------------------------------------------------------------------
                if (importDesign && !importData) {  // Combination 1/5
                    //------------------------------------------------------------------------
                    if (binaryPossible) {
                        console.log('Import Combination 1, fromFile=', fromFile);
                        var finalScript;
                        var tempAppQrs;
                        var tempAppEnigma;
                        var tempAppSession;
                        var tempAppGlobal;
                        var targetAppSession;
                        var targetAppGlobal;

                        // Step 1
                        $('#step1').addClass('busy');
                        if (fromFile) {
                            // Upload file as temp app
                            var file = document.getElementById('fileinput').files[0];
                            tempAppQrs = await uploadApp(file, config, httpHeader);
                        } else {
                            // Copy source app as temp app
                            tempAppQrs = await qrsCall('POST', config.qrsUrl + 'app/' + origAppId + '/copy', httpHeader);
                        }
                        $('#step1').removeClass('busy');
                        $('#step1 .checktick').show();

                        // Step 2
                        $('#step2').addClass('busy');
                        if (importScript) {
                            // Remember temp app's script
                            tempAppSession = enigma.create({
                                schema,
                                url: config.wssUrl + tempAppQrs.id,
                                createSocket: url => new WebSocket(url)
                            })
                            tempAppGlobal = await tempAppSession.open();
                            tempAppEnigma = await tempAppGlobal.openDoc(tempAppQrs.id);
                            finalScript = await tempAppEnigma.getScript();
                            //session remains open for step 3 & 4
                        } else {
                            // Get script of target app
                            targetAppSession = enigma.create({
                                schema,
                                url: config.wssUrl + app.id,
                                createSocket: url => new WebSocket(url)
                            })
                            targetAppGlobal = await targetAppSession.open();
                            targetAppEnigma = await targetAppGlobal.openDoc(app.id);
                            finalScript = await targetAppEnigma.getScript();
                            await targetAppSession.close();
                        }
                        $('#step2').removeClass('busy');
                        $('#step2 .checktick').show();

                        // Step 3: Reload temp app BINARY from target app
                        $('#step3').addClass('busy');
                        if (!tempAppSession) { // if session not already opened in step 2, open now
                            tempAppSession = enigma.create({
                                schema,
                                url: config.wssUrl + tempAppQrs.id,
                                createSocket: url => new WebSocket(url)
                            })
                            tempAppGlobal = await tempAppSession.open();
                            tempAppEnigma = await tempAppGlobal.openDoc(tempAppQrs.id);
                        }
                        await tempAppEnigma.setScript('BINARY [lib://' + settings.dataConnection + '/' + app.id + '];');
                        await tempAppEnigma.doSave();
                        await tempAppEnigma.doReload();
                        await tempAppEnigma.doSave();
                        $('#step3').removeClass('busy');
                        $('#step3 .checktick').show();

                        // Step 4: Revert temp app's script
                        $('#step4').addClass('busy');
                        await tempAppEnigma.setScript(finalScript);
                        await tempAppEnigma.doSave();
                        await tempAppSession.close();
                        $('#step4').removeClass('busy');
                        $('#step4 .checktick').show();

                        // Step 5: Replace target app with temp app
                        $('#step5').addClass('busy');
                        await qrsCall('PUT', config.qrsUrl + 'app/' + tempAppQrs.id + '/replace?app=' + app.id, httpHeader);
                        $('#step5').removeClass('busy');
                        $('#step5 .checktick').show();

                        // Step 6: Delete temp app
                        $('#step6').addClass('busy');
                        await qrsCall('DELETE', config.qrsUrl + 'app/' + tempAppQrs.id, httpHeader);
                        $('#step6').removeClass('busy');
                        $('#step6 .checktick').show();
                    }
                    //------------------------------------------------------------------------
                } else if (importDesign && importData && !importScript) { // Combination 2/5
                    //------------------------------------------------------------------------
                    console.log('Import Combination 2, fromFile=', fromFile);
                    var targetAppScript;
                    var tempAppQrs;
                    var tempAppEnigma;
                    var tempAppSession;
                    var tempAppGlobal;
                    var targetAppSession;
                    var targetAppGlobal;

                    // Step1
                    $('#step1').addClass('busy');
                    if (fromFile) {
                        // Upload file as temp app
                        var file = document.getElementById('fileinput').files[0];
                        tempAppQrs = await uploadApp(file, config, httpHeader);
                    } else {
                        // Copy source app as temp app
                        tempAppQrs = await qrsCall('POST', config.qrsUrl + 'app/' + origAppId + '/copy', httpHeader);
                    }
                    $('#step1').removeClass('busy');
                    $('#step1 .checktick').show();

                    // Step 2: Get script of target app
                    $('#step2').addClass('busy');
                    targetAppSession = enigma.create({
                        schema,
                        url: config.wssUrl + app.id,
                        createSocket: url => new WebSocket(url)
                    })
                    targetAppGlobal = await targetAppSession.open();
                    targetAppEnigma = await targetAppGlobal.openDoc(app.id);
                    targetAppScript = await targetAppEnigma.getScript();
                    await targetAppSession.close();
                    $('#step2').removeClass('busy');
                    $('#step2 .checktick').show();

                    // Step 3: Set temp app's script to target app's script
                    $('#step3').addClass('busy');
                    tempAppSession = enigma.create({
                        schema,
                        url: config.wssUrl + tempAppQrs.id,
                        createSocket: url => new WebSocket(url)
                    })
                    tempAppGlobal = await tempAppSession.open();
                    tempAppEnigma = await tempAppGlobal.openDoc(tempAppQrs.id);
                    await tempAppEnigma.setScript(targetAppScript);
                    await tempAppEnigma.doSave();
                    $('#step3').removeClass('busy');
                    $('#step3 .checktick').show();

                    // Step 4: Replace target app with temp app
                    $('#step4').addClass('busy');
                    await qrsCall('PUT', config.qrsUrl + 'app/' + tempAppQrs.id + '/replace?app=' + app.id, httpHeader);
                    $('#step4').removeClass('busy');
                    $('#step4 .checktick').show();

                    // Step 5: Delete temp app
                    $('#step5').addClass('busy');
                    await qrsCall('DELETE', config.qrsUrl + 'app/' + tempAppQrs.id, httpHeader);
                    $('#step5').removeClass('busy');
                    $('#step5 .checktick').show();

                    //------------------------------------------------------------------------
                } else if (importDesign && importData && importScript) { // Combination 3/5
                    //------------------------------------------------------------------------
                    console.log('Import Combination 3, fromFile=', fromFile);
                    
                    var tempAppQrs;

                    // Step 1: Upload file as temp app
                    $('#step1').addClass('busy');
                    if (fromFile) {
                        var file = document.getElementById('fileinput').files[0];
                        tempAppQrs = await uploadApp(file, config, httpHeader);
                    }
                    $('#step1').removeClass('busy');
                    $('#step1 .checktick').show();

                    // Step 2: Replace target app with temp app
                    $('#step2').addClass('busy');
                    await qrsCall('PUT', config.qrsUrl + 'app/' + (tempAppQrs ? tempAppQrs.id : origAppId)
                        + '/replace?app=' + app.id, httpHeader);
                    $('#step2').removeClass('busy');
                    $('#step2 .checktick').show();

                    // Step 3: Delete temp app
                    $('#step3').addClass('busy');
                    if (fromFile) {
                        await qrsCall('DELETE', config.qrsUrl + 'app/' + tempAppQrs.id, httpHeader);
                    }
                    $('#step3').removeClass('busy');
                    $('#step3 .checktick').show();

                    //------------------------------------------------------------------------
                } else if (!importDesign && importData) { // Combination 4/5
                    //------------------------------------------------------------------------
                    if (binaryPossible) {
                        console.log('Import Combination 4, fromFile=', fromFile);
                        var tempAppQrs = {};
                        var targetCopyAppQrs;
                        var targetCopyAppGlobal;
                        var targetCopyAppEnigma;
                        var targetCopyAppSession;
                        var finalScript;
                        var sourceAppGlobal;
                        var sourceAppEnigma;
                        var sourceAppSession;

                        // Step 1: Upload file as temp source app
                        $('#step1').addClass('busy');
                        if (fromFile) {
                            var file = document.getElementById('fileinput').files[0];
                            tempAppQrs = await uploadApp(file, config, httpHeader);
                            console.log('tempAppQrs: ' + tempAppQrs.id);
                        } else if (!userIsOwnerOfSrcApp) {
                            tempAppQrs = await qrsCall('POST', config.qrsUrl + 'app/' + origAppId + '/copy', httpHeader);
                        }
                        $('#step1').removeClass('busy');
                        $('#step1 .checktick').show();

                        // Step 2: Create copy of target app
                        $('#step2').addClass('busy');
                        targetCopyAppQrs = await qrsCall('POST', config.qrsUrl + 'app/' + app.id + '/copy', httpHeader);
                        $('#step2').removeClass('busy');
                        $('#step2 .checktick').show();

                        // Step 3
                        $('#step3').addClass('busy');
                        if (importScript) {
                            console.log(478);
                            // Get source app's script
                            sourceAppSession = enigma.create({
                                schema,
                                url: config.wssUrl + (tempAppQrs.id ? tempAppQrs.id : origAppId),
                                createSocket: url => new WebSocket(url)
                            })
                            sourceAppGlobal = await sourceAppSession.open();
                            sourceAppEnigma = await sourceAppGlobal.openDoc(tempAppQrs.id ? tempAppQrs.id : origAppId);
                            finalScript = await sourceAppEnigma.getScript();
                            await sourceAppSession.close();
                        } else {
                            console.log(492);
                            // Remember script of copied app
                            targetCopyAppSession = enigma.create({
                                schema,
                                url: config.wssUrl + targetCopyAppQrs.id,
                                createSocket: url => new WebSocket(url)
                            })
                            targetCopyAppGlobal = await targetCopyAppSession.open();
                            targetCopyAppEnigma = await targetCopyAppGlobal.openDoc(targetCopyAppQrs.id);
                            finalScript = await targetCopyAppEnigma.getScript();
                            //await targetCopyAppSession.close();  // don't close, will be done in step 5
                        }
                        if (finalScript.length == 0) alert('could not get script!');
                        $('#step3').removeClass('busy');
                        $('#step3 .checktick').show();

                        // Step 4: Reload copied app BINARY from source app
                        $('#step4').addClass('busy');
                        if (!targetCopyAppSession) { // if session not already opened in step 3, open now
                            targetCopyAppSession = enigma.create({
                                schema,
                                url: config.wssUrl + targetCopyAppQrs.id,
                                createSocket: url => new WebSocket(url)
                            })
                            targetCopyAppGlobal = await targetCopyAppSession.open();
                            targetCopyAppEnigma = await targetCopyAppGlobal.openDoc(targetCopyAppQrs.id);
                        }
                        await targetCopyAppEnigma.setScript('BINARY [lib://' + settings.dataConnection + '/' + (tempAppQrs.id ? tempAppQrs.id : origAppId) + '];');
                        await targetCopyAppEnigma.doSave();
                        await targetCopyAppEnigma.doReload();
                        await targetCopyAppEnigma.doSave();
                        $('#step4').removeClass('busy');
                        $('#step4 .checktick').show();

                        // Step 5: Revert copied app's script 
                        $('#step5').addClass('busy');
                        await targetCopyAppEnigma.setScript(finalScript);
                        await targetCopyAppEnigma.doSave();
                        await targetCopyAppSession.close();
                        $('#step5').removeClass('busy');
                        $('#step5 .checktick').show();

                        // Step 6: Replace target app with copied app
                        $('#step6').addClass('busy');
                        await qrsCall('PUT', config.qrsUrl + 'app/' + targetCopyAppQrs.id + '/replace?app=' + app.id, httpHeader);
                        $('#step6').removeClass('busy');
                        $('#step6 .checktick').show();

                        // Step 7: Delete copied app
                        $('#step7').addClass('busy');
                        await qrsCall('DELETE', config.qrsUrl + 'app/' + targetCopyAppQrs.id, httpHeader);
                        $('#step7').removeClass('busy');
                        $('#step7 .checktick').show();

                        // Step 8: Delete temp app
                        $('#step8').addClass('busy');
                        if (fromFile || !userIsOwnerOfSrcApp) {
                            await qrsCall('DELETE', config.qrsUrl + 'app/' + tempAppQrs.id, httpHeader);
                        }
                        $('#step8').removeClass('busy');
                        $('#step8 .checktick').show();
                    }
                    //------------------------------------------------------------------------                      
                } else if (!importDesign && !importData && importScript) { // Combination 5/5
                    //------------------------------------------------------------------------
                    console.log('Import Combination 5, fromFile=', fromFile);
                    var tempAppQrs = {};
                    var sourceAppEnigma, sourceAppSession, sourceAppGlobal;
                    var targetAppEnigma, targetAppSession, targetAppGlobal;
                    var finalScript;

                    // Step 1: Upload file as temp source app
                    $('#step1').addClass('busy');
                    if (fromFile) {
                        var file = document.getElementById('fileinput').files[0];
                        tempAppQrs = await uploadApp(file, config, httpHeader);
                    } else if (!userIsOwnerOfSrcApp) {
                        tempAppQrs = await qrsCall('POST', config.qrsUrl + 'app/' + origAppId + '/copy', httpHeader);
                    }

                    $('#step1').removeClass('busy');
                    $('#step1 .checktick').show();

                    // Step 2: Get source app's script
                    $('#step2').addClass('busy');
                    sourceAppSession = enigma.create({
                        schema,
                        url: config.wssUrl + (tempAppQrs.id ? tempAppQrs.id : origAppId),
                        createSocket: url => new WebSocket(url)
                    })
                    sourceAppGlobal = await sourceAppSession.open();
                    sourceAppEnigma = await sourceAppGlobal.openDoc(tempAppQrs.id ? tempAppQrs.id : origAppId);
                    finalScript = await sourceAppEnigma.getScript();
                    console.log('script will be:', finalScript);
                    if (finalScript.length == 0) alert('couldnt get script. Aborting');

                    await sourceAppSession.close();
                    $('#step2').removeClass('busy');
                    $('#step2 .checktick').show();

                    // Step 3: Set target app's script
                    $('#step3').addClass('busy');
                    targetAppSession = enigma.create({
                        schema,
                        url: config.wssUrl + app.id,
                        createSocket: url => new WebSocket(url)
                    })
                    targetAppGlobal = await targetAppSession.open();
                    targetAppEnigma = await targetAppGlobal.openDoc(app.id);
                    await targetAppEnigma.setScript(finalScript);
                    await targetAppEnigma.doSave();
                    await targetAppSession.close();
                    $('#step3').removeClass('busy');
                    $('#step3 .checktick').show();

                    // Step 4: Delete temp source app
                    $('#step4').addClass('busy');
                    if (fromFile || !userIsOwnerOfSrcApp) {
                        await qrsCall('DELETE', config.qrsUrl + 'app/' + tempAppQrs.id, httpHeader);
                    }
                    $('#step4').removeClass('busy');
                    $('#step4 .checktick').show();
                }
                $('#freedatabridge').show();
                return 1;

            } catch (err) {
                luiDialog('579', 'Error', JSON.stringify(err), null, 'Close', false);
                return -1;
            }
        },

        uploadNew: async function (settings, config, httpHeader, stream) {
            var file = document.getElementById('fileinput').files[0];
            if (file != undefined) {
                $('#msgbody').hide();
                $('#spinningwheel').show();
                const newApp = await uploadApp(file, config, httpHeader);
                if (JSON.stringify(newApp).substr(0, 1) == '{') {
                    if (stream != 'mywork') {
                        const result = await qrsCall('PUT', config.qrsUrl + 'app/' + newApp.id + '/publish?stream=' + stream, httpHeader);
                        $('#msgparent_uploadnew').remove();
                        luiDialog('upload', 'Success', 'App published in stream ' + result.stream.name, null, 'Close', false);
                    } else {
                        $('#msgparent_uploadnew').remove();
                        luiDialog('upload', 'Success', 'App uploaded in My Work', null, 'Close', false);
                    }
                } else {
                    $('#msgparent_uploadnew').remove();
                }
            };
        },

        //=============================================================================================
        qrsCall: async function (method, endpoint, headerParam, body) {
            var result = await qrsCall(method, endpoint, headerParam, body);
            return result;
        }
    };


    //=========================================================================================    
    function luiDialog(ownId, title, detail, ok, cancel, inverse) {
        // This html was found on https://qlik-oss.github.io/leonardo-ui/dialog.html

        var node = document.createElement("div");
        node.id = "msgparent_" + ownId;
        var html =
            '  <div class="lui-modal-background"></div>' +
            '  <div class="lui-dialog' + (inverse ? '  lui-dialog--inverse' : '') + '" style="width: 400px;top:80px;">' +
            '    <div class="lui-dialog__header">' +
            '      <div class="lui-dialog__title">' + title + '</div>' +
            '    </div>' +
            '    <div class="lui-dialog__body">' +
            detail +
            '    </div>' +
            '    <div class="lui-dialog__footer">' +
            '    <span id="freedatabridge">A free service by <a href="https://www.databridge.ch" target="_blank">data/\\bridge</a>. We love data.</span>';
        if (cancel) {
            html +=
                '  <button class="lui-button  lui-dialog__button' + (inverse ? '  lui-button--inverse' : '') + '" ' +
                '   onclick="var elem=document.getElementById(\'msgparent_' + ownId + '\');elem.parentNode.removeChild(elem);">' +
                cancel +
                ' </button>'
        }
        if (ok) {
            html +=
                '  <button class="lui-button  lui-dialog__button  ' + (inverse ? '  lui-button--inverse' : '') + '" id="msgok_' + ownId + '">' +
                ok +
                ' </button>'
        };
        html +=
            '     </div>' +
            '  </div>';
        node.innerHTML = html;
        document.getElementById("qs-page-container").append(node);
    };

    //=========================================================================================
    async function qrsCall(method, endpoint, headerParam, body) {

        let result;
        try {
            var headersPriv = JSON.parse(JSON.stringify(headerParam));
            if (!headersPriv.hasOwnProperty('Content-Type') && method.toUpperCase() != 'GET') {
                // if method isn't GET then set Content-Type in http-request-header to a default
                headersPriv["Content-Type"] = 'application/json';
            }

            // if the url doesn't contain querystring "xrfkey" add it.
            if (endpoint.indexOf('xrfkey') == -1) {
                endpoint += (endpoint.indexOf('?') == -1 ? '?xrfkey=' : '&xrfkey=') + headersPriv['X-Qlik-Xrfkey'];
            }
            var args = {
                timeout: 0,
                method: method,
                url: endpoint,
                headers: headersPriv
            };
            if (body) args.data = body;
            if (logQrsCommunication) console.log('QRS API request', args);
            result = await $.ajax(args);
            if (logQrsCommunication) console.log('QRS API response', result);
            return result;
        } catch (error) {
            luiDialog('111', 'Error', error.status + ' ' + error.responseText, null, 'Close', false);
            console.log('error', error.status + ' ' + error.responseText);
        }
    };


    async function uploadApp(file, config, httpHeader) {
        console.log('uploading file', file, httpHeader);
        const xrfKey = httpHeader["X-Qlik-Xrfkey"];
        //newXrfKey();
        const ret = await $.ajax({
            url: config.qrsUrl + "app/upload?name=" + file.name.split('.qvf')[0] + '&keepData=true&xrfkey=' + xrfKey,
            type: "POST",
            data: file,
            contentType: 'application/vnd.qlik.sense.app',
            processData: false,
            headers: httpHeader,
            /*success: function (response) {
                if (response != 0) {
                    alert('File uploaded');
                } else {
                    alert('file not uploaded');
                }
            }*/
        });
        //console.log('result of upload:', ret);
        return ret
    };


})
