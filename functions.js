define([], function () {

    return {
        // settings for QRS API access via a header-authenticated virtual proxy

        //=============================================================================================
        luiDialog: function (ownId, title, detail, ok, cancel, inverse, width) {
            luiDialog(ownId, title, detail, ok, cancel, inverse, width);
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

        showScript: async function (enigma, schema, config, app, deleteAfter, httpHeader) {

            $('#spinningwheel').show();
            $('#contextmenu').hide();
            console.log('function showScript ' + app.id);
            const session = enigma.create({
                schema,
                url: config.wssUrl + app.id,
                createSocket: url => new WebSocket(url)
            })

            const global = await session.open();
            const enigmaApp = await global.openDoc(app.id);
            var script = await enigmaApp.getScript();
            scriptRows = script.split('\n');
            var tabs = [];
            scriptRows.forEach(function (row, i) {
                if (row.substr(0, 7) == '///$tab') {
                    const tabName = row.substr(8).replace('\r', '');
                    tabs.push(tabName);
                    scriptRows[i] = '</p><hr /><p class="qscript" id="script_' + tabName + '">';
                }
            })

            $('.work-area').append('<div id="scriptviewerparent"><table><tbody>'
                + '<tr><td style="width:15%"><div id="scriptviewer_header">'
                + '<button class="lui-button" onclick="$(\'#scriptviewerparent\').remove();">Close</button>'
                + '</div></td><td id="scriptviewer2" style="width:85%;"></td></tr></tbody></table>');
            //$('#scriptviewer_header').append('<ul class="lui-tabset">');
            $('#scriptviewer_header').append('<lu>');
            tabs.forEach(function (tab) {
                $('#scriptviewer_header').append('<li class="lui-tab" onclick="document.getElementById(\'script_' + tab + '\').scrollIntoView();">' + tab + '</li>');
            });
            $('#scriptviewer_header').append('</lu>');
            $('#scriptviewer2').append('<p class="qscript">' + scriptRows.join('<br />') + '</p>');
            //$('#scriptviewer textarea').text(script);
            //$('#scriptviewer textarea').html($('#scriptviewer textarea').html().replace(/\/\/\/\$tab/g, '<hr />///$tab'));
            /*var wnd = window.open("about:blank", "", "_blank");
            wnd.document.write('<html><head></head>'
                + '<body style="font-family:monospace;">'
                + script.replace(/\n/g, '<br/>').replace(/\/\/\/\$tab/g, '<hr/>///$tab')
                + '</body></html>');
            */
            await session.close();
            if (deleteAfter) qrsCall('DELETE', config.qrsUrl + 'app/' + app.id, httpHeader);
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

        //-----------------------------------------------------------------------------------------------------
        previewSteps: function (thisUser, appList, fromFile, licensed) {
            //-----------------------------------------------------------------------------------------------------
            const importDesign = $('#importdesign').is(':checked');
            const importScript = $('#importscript').is(':checked');
            const importData = $('#importdata').is(':checked');
            const reloadAfter = $('#reloadafter').is(':checked');
            const noNewSheets = $('#importdesign').is(':checked') && $('#nonewsheets').is(':checked');
            const removeTag = $('#check_removetag').is(':checked') ? $('#select_removetag').val() : null;
            const addTag = $('#check_addtag').is(':checked') ? $('#input_addtag').val() : null;
            const origAppId = $('#fromapp_id').text();
            const isOwnerOfSrcApp = fromFile ? true : (thisUser == $('#fromapp_owner').text());

            $('#nonewsheets').attr("disabled", !importDesign);
            $('#btn_startcopy').attr("disabled", !(importDesign || importData || importScript || removeTag || addTag || reloadAfter));
            $('#nobinaryerror').hide();

            if ($('#fromapp_id').text() == $('#toapp_id').text()) {
                $('#sameapperror').show();
                $('#btn_startcopy').attr('disabled', true);
            }
            var trgtApps = appList || [{
                id: $('#toapp_id').text(),
                owner: { userDirectory: $('#toapp_owner').text().split('\\')[0], userId: $('#toapp_owner').text().split('\\')[0] }
            }];
            if (trgtApps.length > 3 && !licensed) {
                $('#freeversionwarning').show();
                trgtApps = trgtApps.slice(0, 3);
            }


            const qrsTag = '<span class="tag-qrs"></span>';
            const enigmaTag = '<span class="tag-enigma"></span>';
            const binaryPossible = $('#dConnectionIcon').hasClass('lui-icon--tick');
            var binaryNeeded = false;
            var actions;
            // fill a href attribut to deeplink this combination
            const deeplink = location.href.substr(0, location.href.length - location.search.length)
                + '?from=' + (fromFile ? 'file' : origAppId)
                + ($('#toapp_id').text().substr(0, 2) == '-m' ? ('&stream=' + $('#select_stream').find(":selected").val()) : ('&app=' + $('#toapp_id').text()))
                + (importDesign ? '&importdesign' : '')
                + (noNewSheets ? '&nonewsheets' : '')
                + (importData ? '&importdata' : '')
                + (importScript ? '&importscript' : '')
                + (reloadAfter ? '&reloadafter' : '')
                + (removeTag ? ('&removetag=' + removeTag) : '')
                + (addTag ? ('&addtag=' + addTag) : '');
            $('#a_deeplink').attr('href', deeplink);
            // reset step texts and hide them
            //for (var step = 1; step <= 8; step++) {
            //    $("#step" + step + " .steptext").text('');
            //    $("#step" + step).hide();
            //}
            $('#steplist_parent tbody').empty();

            function createStepHTML(stepNo, text, rowSpan, trgtAppId, rowSpanText, bgColor) {
                return '<tr id="step' + stepNo + '" class="steplist">'
                    + '<td class="stepcheck"' + (bgColor ? (' style="background-color:' + bgColor + ';">') : '>')
                    + '  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"'
                    + '    viewBox="0 0 512 512" xml:space="preserve">'
                    + '    <path class="checkcircle" d="M437.019,74.98C388.667,26.629,324.38,0,256,0C187.619,0,123.331,26.629,74.98,74.98C26.628,123.332,0,187.62,0,256'
                    + " s26.628,132.667,74.98,181.019C123.332,485.371,187.619,512,256,512c68.38,0,132.667-26.629,181.019-74.981"
                    + " C485.371,388.667,512,324.38,512,256S485.371,123.333,437.019,74.98z M256,482C131.383,482,30,380.617,30,256S131.383,30,256,30"
                    + '	s226,101.383,226,226S380.617,482,256,482z"/>'
                    + '    <path class="checktick" d="M378.305,173.859c-5.857-5.856-15.355-5.856-21.212,0.001L224.634,306.319l-69.727-69.727'
                    + " c-5.857-5.857-15.355-5.857-21.213,0c-5.858,5.857-5.858,15.355,0,21.213l80.333,80.333c2.929,2.929,6.768,4.393,10.606,4.393"
                    + '	c3.838,0,7.678-1.465,10.606-4.393l143.066-143.066C384.163,189.215,384.163,179.717,378.305,173.859z"/>'
                    + '    <path class="checkfailed" d="m156.41796,376.41432c0,0 101.24867,-101.24867 101.24867,-101.24867c0,0 102.91531,102.49865 '
                    + '     102.91531,102.49865c0,0 21.24972,-21.66638 21.24972,-21.66638c0,0 -102.08199,-102.08199 -102.08199,-102.08199c0,0 102.08199,-103.33197 '
                    + '     102.08199,-103.33197c0,0 -19.99974,-21.66638 -19.99974,-21.66638c0,0 -103.74864,103.74864 -103.74864,103.74864c0,0 -102.08199,-102.08199 '
                    + '     -102.08199,-102.08199c0,0 -21.24972,21.24972 -21.24972,21.24972c0,0 102.08199,101.24867 101.91198,101.07941c0.17001,0.16926 '
                    + '     -101.49532,103.08457 -101.49532,103.08457c0,0 21.24972,20.4164 21.24972,20.4164l0.00001,-0.00001z" />'
                    + '  </svg>'
                    + '</td>'
                    + '<td class="steptext"' + (bgColor ? (' style="background-color:' + bgColor + ';">') : '>') + text + '</td>'
                    + (rowSpan ? ('<td style="width:30%;' + (bgColor ? ('background-color:' + bgColor + ';"') : '"') + ' rowspan="' + rowSpan
                        + '" class="nextapp" trgtappid="' + trgtAppId + '">' + rowSpanText + '<td>') : '')
                    + '</tr>'
            };

            function getStepsFor(importDesign, importData, importScript, fromFile, isOwnerOfSrcApp, isOwnerOfTrgtApp) {
                //console.log('getStepsFor fromFile=', fromFile);

                const cos = "<!--cos-->Copy source app as temp source-copy" + qrsTag;
                const cot = "<!--cot-->Copy target app as temp target-copy" + qrsTag;
                const uts = "<!--uts-->Upload app as temp source-copy" + qrsTag;
                const dts = "<!--dts-->Delete temp source-copy" + qrsTag;
                const dtt = "<!--dtt-->Delete temp target-copy" + qrsTag;
                const ts2ot = "<!--ts2ot-->Temp source-copy replaces target app" + qrsTag;
                const os2ot = "<!--os2ot-->Source app replaces target app" + qrsTag;
                const tt2ot = "<!--tt2ot-->Temp target-copy replaces target app" + qrsTag;
                const goss = "<!--goss-->Get script of original source app" + enigmaTag;
                const gtss = "<!--gtss-->Get script of temp source-copy" + enigmaTag;
                const gtts = "<!--gtts-->Get script of temp target-copy" + enigmaTag;
                const gots = "<!--gots-->Get script of original target" + enigmaTag;
                const rtss = "<!--rtss-->Revert script of temp source app" + enigmaTag;
                const rtts = "<!--rtts-->Revert script of temp target app" + enigmaTag;
                const oss2ot = "<!--oss2ot-->Copy source script to target" + enigmaTag;
                const oss2tt = "<!--oss2tt-->Copy source script to target-copy" + enigmaTag;
                const osd2tt = "<!--osd2tt-->Copy source data to target copy (binary)" + enigmaTag;
                const tss2ot = "<!--tss2ot-->Copy source-copy's script to target" + enigmaTag;
                const tss2tt = "<!--tss2tt-->Copy source-copy's script to target-copy" + enigmaTag;
                const tsd2tt = "<!--tsd2tt-->Copy source-copy's data to target copy (binary)" + enigmaTag;
                const tts2ts = "<!--tts2ts-->Copy target-copy's script to source-copy" + enigmaTag;
                const ots2ts = "<!--ots2ts-->Copy target script to source-copy" + enigmaTag;
                const otd2ts = "<!--otd2ts-->Copy target data to source-copy (binary)" + enigmaTag;
                const otr = "<!--otr-->Start background reload of target app" + qrsTag;
                const ottag = "<!--ottag-->Update target app's tags" + qrsTag;
                var ret;

                if (importDesign && importData && importScript && !fromFile) {
                    //------------------------------------------------------------------------
                    ret = {
                        combination: '7',
                        descr: "Copy entire app from source to target",
                        variant: 'default',
                        binaryNeeded: false,
                        init: [],
                        loop: [os2ot],
                        wrapUp: []
                    };
                    //------------------------------------------------------------------------
                } else if (importDesign && importData && importScript && fromFile) {
                    //------------------------------------------------------------------------
                    ret = {
                        combination: '7u',
                        descr: "Upload app and copy entire app to target",
                        variant: 'default',
                        binaryNeeded: false,
                        init: [uts],
                        loop: [ts2ot],
                        wrapUp: [dts]
                    };
                    //------------------------------------------------------------------------
                } else if (importDesign && !importData && importScript) {
                    //------------------------------------------------------------------------
                    ret = {
                        combination: '5',
                        descr: "Copy design and script but leave the data unchanged",
                        variant: fromFile ? 'from file' : 'default',
                        binaryNeeded: true,
                        init: [(fromFile ? uts : cos), gtss],
                        loop: [otd2ts, rtss, ts2ot],
                        wrapUp: [dts]
                    };
                    //------------------------------------------------------------------------
                } else if (importDesign && !importData && !importScript) {
                    //------------------------------------------------------------------------
                    ret = {
                        combination: '4',
                        descr: "Copy design but leave the data and script unchanged",
                        variant: isOwnerOfTrgtApp ? (fromFile ? 'owner of target, from file' : 'owner of target')
                            : (fromFile ? 'from file' : 'default'),
                        binaryNeeded: true,
                        init: [fromFile ? uts : cos],
                        loop: isOwnerOfTrgtApp ? [gots, otd2ts, ots2ts, ts2ot]
                            : [cot, gtts, dtt, otd2ts, tts2ts, ts2ot],
                        wrapUp: [dts]
                    };
                    //------------------------------------------------------------------------
                } else if (importDesign && importData && !importScript) {
                    //------------------------------------------------------------------------
                    ret = {
                        combination: '6',
                        descr: "Copy design and data but leave the script unchanged",
                        variant: isOwnerOfTrgtApp ? (fromFile ? 'owner of target, from file' : 'owner of target')
                            : (fromFile ? 'from file' : 'default'),
                        binaryNeeded: false,
                        init: [fromFile ? uts : cos],
                        loop: isOwnerOfTrgtApp ? [gots, ots2ts, ts2ot]
                            : [cot, gtts, dtt, tts2ts, ts2ot],
                        wrapUp: [dts]
                    };
                    //------------------------------------------------------------------------
                } else if (!importDesign && importData && importScript && (!isOwnerOfSrcApp || fromFile)) {
                    //------------------------------------------------------------------------
                    ret = {
                        combination: '3',
                        descr: "Copy data and script but leave design unchanged",
                        variant: fromFile ? 'from file' : 'default',
                        binaryNeeded: true,
                        init: [(fromFile ? uts : cos), gtss],
                        loop: [cot, tsd2tt, tss2tt, tt2ot, dtt],
                        wrapUp: [dts]
                    };
                    //------------------------------------------------------------------------                      
                } else if (!importDesign && importData && importScript && isOwnerOfSrcApp) {
                    //------------------------------------------------------------------------
                    ret = {
                        combination: '3o',
                        descr: "Copy data and script but leave design unchanged (you're owner of source app)",
                        variant: 'from file',
                        binaryNeeded: true,
                        init: [goss],
                        loop: [cot, osd2tt, oss2tt, tt2ot, dtt],
                        wrapUp: []
                    };
                    //------------------------------------------------------------------------                      
                } else if (!importDesign && importData && !importScript && (!isOwnerOfSrcApp || fromFile)) {
                    //------------------------------------------------------------------------
                    ret = {
                        combination: '2',
                        descr: "Copy data but leave design and script unchanged",
                        variant: fromFile ? 'from file' : 'default',
                        binaryNeeded: true,
                        init: [fromFile ? uts : cos],
                        loop: [cot, gtts, tsd2tt, rtts, tt2ot, dtt],
                        wrapUp: [dts]
                    };
                    //------------------------------------------------------------------------                      
                } else if (!importDesign && importData && !importScript && isOwnerOfSrcApp) {
                    //------------------------------------------------------------------------
                    ret = {
                        combination: '2o',
                        descr: "Copy data but leave design and script unchanged (you're owner of source app)",
                        variant: 'default',
                        binaryNeeded: true,
                        init: [],
                        loop: [cot, gtts, osd2tt, rtts, tt2ot, dtt],
                        wrapUp: []
                    };
                    //------------------------------------------------------------------------                      
                } else if (!importDesign && !importData && importScript && (!isOwnerOfSrcApp || fromFile)) {
                    //------------------------------------------------------------------------
                    ret = {
                        combination: '1',
                        descr: "Copy only the script to the target app",
                        variant: isOwnerOfTrgtApp ? (fromFile ? 'owner of target, from file' : 'owner of target')
                            : (fromFile ? 'from file' : 'default'),
                        binaryNeeded: false,
                        init: [(fromFile ? uts : cos), gtss],
                        loop: isOwnerOfTrgtApp ? [tss2ot]
                            : [cot, tss2tt, tt2ot, dtt],
                        wrapUp: [dts]
                    };
                    //------------------------------------------------------------------------
                } else if (!importDesign && !importData && importScript && isOwnerOfSrcApp) {
                    //------------------------------------------------------------------------
                    ret = {
                        combination: '1o',
                        descr: "Copy only the script to the target app (you're owner of source app)",
                        variant: isOwnerOfTrgtApp ? 'owner of target' : 'default',
                        binaryNeeded: false,
                        init: [goss],
                        loop: isOwnerOfTrgtApp ? [oss2ot]
                            : [cot, oss2tt, tt2ot, dtt],
                        wrapUp: []
                    };
                    //------------------------------------------------------------------------
                } else if (!importDesign && !importData && !importScript) {
                    //------------------------------------------------------------------------
                    ret = {
                        combination: '0',
                        descr: 'Nothing to be copied.',
                        variant: 'default',
                        binaryNeeded: false,
                        init: [],
                        loop: [],
                        wrapUp: []
                    }
                    //} else {
                    //    ret = { error: true, combination: "none" }
                }
                //if (ret.error != true && (importDesign || importData || importScript)) {
                if (reloadAfter) ret.loop.push(otr);
                //}
                if (removeTag || addTag) ret.loop.push(ottag);
                return ret;
            }
            /*
                    console.log('Combinations:');
                    var log;
                    log = getStepsFor(false, false, true, false, false, false); console.log(log.combination, log.variant);
                    log = getStepsFor(false, false, true, false, false, true); console.log(log.combination, log.variant);
                    log = getStepsFor(false, false, true, false, true, false); console.log(log.combination, log.variant);
                    log = getStepsFor(false, false, true, false, true, true); console.log(log.combination, log.variant);
                    log = getStepsFor(false, false, true, true, true, false); console.log(log.combination, log.variant);
                    log = getStepsFor(false, false, true, true, true, true); console.log(log.combination, log.variant);
                    log = getStepsFor(false, true, false, false, false, false); console.log(log.combination, log.variant);
                    log = getStepsFor(false, true, false, false, false, true); console.log(log.combination, log.variant);
                    log = getStepsFor(false, true, false, false, true, false); console.log(log.combination, log.variant);
                    log = getStepsFor(false, true, false, false, true, true); console.log(log.combination, log.variant);
                    log = getStepsFor(false, true, false, true, true, false); console.log(log.combination, log.variant);
                    log = getStepsFor(false, true, false, true, true, true); console.log(log.combination, log.variant);
                    log = getStepsFor(false, true, true, false, false, false); console.log(log.combination, log.variant);
                    log = getStepsFor(false, true, true, false, false, true); console.log(log.combination, log.variant);
                    log = getStepsFor(false, true, true, false, true, false); console.log(log.combination, log.variant);
                    log = getStepsFor(false, true, true, false, true, true); console.log(log.combination, log.variant);
                    log = getStepsFor(false, true, true, true, true, false); console.log(log.combination, log.variant);
                    log = getStepsFor(false, true, true, true, true, true); console.log(log.combination, log.variant);
                    log = getStepsFor(true, false, false, false, false, false); console.log(log.combination, log.variant);
                    log = getStepsFor(true, false, false, false, false, true); console.log(log.combination, log.variant);
                    log = getStepsFor(true, false, false, false, true, false); console.log(log.combination, log.variant);
                    log = getStepsFor(true, false, false, false, true, true); console.log(log.combination, log.variant);
                    log = getStepsFor(true, false, false, true, true, false); console.log(log.combination, log.variant);
                    log = getStepsFor(true, false, false, true, true, true); console.log(log.combination, log.variant);
                    log = getStepsFor(true, false, true, false, false, false); console.log(log.combination, log.variant);
                    log = getStepsFor(true, false, true, false, false, true); console.log(log.combination, log.variant);
                    log = getStepsFor(true, false, true, false, true, false); console.log(log.combination, log.variant);
                    log = getStepsFor(true, false, true, false, true, true); console.log(log.combination, log.variant);
                    log = getStepsFor(true, false, true, true, true, false); console.log(log.combination, log.variant);
                    log = getStepsFor(true, false, true, true, true, true); console.log(log.combination, log.variant);
                    log = getStepsFor(true, true, false, false, false, false); console.log(log.combination, log.variant);
                    log = getStepsFor(true, true, false, false, false, true); console.log(log.combination, log.variant);
                    log = getStepsFor(true, true, false, false, true, false); console.log(log.combination, log.variant);
                    log = getStepsFor(true, true, false, false, true, true); console.log(log.combination, log.variant);
                    log = getStepsFor(true, true, false, true, true, false); console.log(log.combination, log.variant);
                    log = getStepsFor(true, true, false, true, true, true); console.log(log.combination, log.variant);
                    log = getStepsFor(true, true, true, false, false, false); console.log(log.combination, log.variant);
                    log = getStepsFor(true, true, true, false, false, true); console.log(log.combination, log.variant);
                    log = getStepsFor(true, true, true, false, true, false); console.log(log.combination, log.variant);
                    log = getStepsFor(true, true, true, false, true, true); console.log(log.combination, log.variant);
                    log = getStepsFor(true, true, true, true, true, false); console.log(log.combination, log.variant);
                    log = getStepsFor(true, true, true, true, true, true); console.log(log.combination, log.variant);
         */


            var step = 0;
            var block = 1;
            var altColors = ['#ffffff', '#f0f0f0'];  // background-color for each block
            var binaryNeeded = false;

            for (var a = 0; a < trgtApps.length; a++) {
                const trgtAppId = trgtApps[a].id;
                if (trgtAppId == origAppId) {
                    console.log('Actions skipped where source and target app are the same ' + trgtAppId);
                } else {
                    //const trgtAppOwner = trgtApps[a].owner.userDirectory + '\\' + trgtApps[a].owner.userId;
                    //console.log('getStepsFor(isOwnerOfSrcApp=',isOwnerOfSrcApp,'ownerOfTrgApp',  trgtApps[a].owner);
                    const actions = getStepsFor(importDesign, importData, importScript, fromFile, isOwnerOfSrcApp, trgtApps[a].owner == thisUser);
                    //console.log(a, actions);
                    binaryNeeded = binaryNeeded || actions.binaryNeeded;
                    if (step == 0) {
                        $('#steps_info').html('(' + actions.combination + ') ' + actions.descr);
                        // Get init actions
                        for (var i = 0; i < actions.init.length; i++) {
                            step++;
                            $('#steplist_parent tbody').append(
                                createStepHTML(step, actions.init[i], i == 0 ? actions.init.length : null, trgtAppId,
                                    'Initial', altColors[block % 2])
                            );
                        }
                        if (step > 0) block++;
                    }
                    // get loop actions for current target app
                    for (var i = 0; i < actions.loop.length; i++) {
                        step++;
                        $('#steplist_parent tbody').append(
                            createStepHTML(step, actions.loop[i], i == 0 ? actions.loop.length : null, trgtAppId,
                                'Combi <b>' + actions.combination + '/' + actions.variant + '</b><br />'
                                + '<i>' + trgtApps[a].name + '</i>&nbsp;'
                                + '<span title="' + trgtAppId + '" class="lui-icon  lui-icon--info" style="color:#b2b2b2;"></span>'
                                , altColors[block % 2])
                        );
                    }
                    block++;
                    if (a == (trgtApps.length - 1)) {
                        // get wrapup actions
                        for (var i = 0; i < actions.wrapUp.length; i++) {
                            step++;
                            $('#steplist_parent tbody').append(
                                createStepHTML(step, actions.wrapUp[i], i == 0 ? actions.wrapUp.length : null, trgtAppId,
                                    'Clean-up', altColors[block % 2])
                            );
                        }
                    }
                }
            }

            $('#stepscounter').text('(' + step + ')');
            if (binaryNeeded && !binaryPossible) {
                $('#nobinaryerror').show();
                $('#btn_startcopy').attr('disabled', true);
            }
        },


        //------------------------------------------------------------------------
        executeSteps: async function (enigma, schema, httpHeader, from, config, settings, thisUser, trgtAppList, addTag, removeTag, noNewSheets) {
            //------------------------------------------------------------------------
            // from can be an object (from fileinput2 form) or just a string with the id.

            var steps = [];
            $('#steplist_parent tr').each(async function (i, e) {
                steps.push({
                    number: i + 1,
                    descr: $(e).find('.steptext').text(),
                    actionId: $(e).find('.steptext').html().split('<!--')[1].split('-->')[0],
                    nextApp: $(e).find('.nextapp').length,
                    trgtAppId: $(e).find('.nextapp').attr('trgtappid')
                });
            });
            console.log('steps', steps, from);

            var os_id = !from ? null : (from.name ? null : from);  // source app id or upload-file object 
            var oss; // original source app script
            var os_session, os_global, os_enigma;
            var ts_id;  // app-id of temp source-copy
            var tss; // temp source-copy app script
            var ts_session, ts_global, ts_enigma;
            var tt_id;  // app-id of temp target-copy
            var tts; // temp target-copy app script
            var tt_session, tt_global, tt_enigma;
            var ot_id;  // app-id of original target app
            var ots; // original target app script
            var ot_session, ot_global, ot_enigma;
            var ot_sh; // original target sheet list

            async function getEnigma_os() {
                if (!os_enigma) {
                    console.log('Opening enigma session to source app ' + os_id);
                    os_session = enigma.create({
                        schema,
                        url: config.wssUrl + os_id,
                        createSocket: url => new WebSocket(url)
                    });
                    os_global = await os_session.open();
                    os_enigma = await os_global.openDoc(os_id);
                }
            }
            async function getEnigma_ts() {
                if (!ts_enigma) {
                    console.log('Opening enigma session to temp source-copy app ' + ts_id);
                    ts_session = enigma.create({
                        schema,
                        url: config.wssUrl + ts_id,
                        createSocket: url => new WebSocket(url)
                    });
                    ts_global = await ts_session.open();
                    ts_enigma = await ts_global.openDoc(ts_id);
                }
            }
            async function getEnigma_ot() {
                if (!ot_enigma) {
                    console.log('Opening enigma session to target app ' + ot_id);
                    ot_session = enigma.create({
                        schema,
                        url: config.wssUrl + ot_id,
                        createSocket: url => new WebSocket(url)
                    });
                    ot_global = await ot_session.open();
                    ot_enigma = await ot_global.openDoc(ot_id);
                }
            }
            async function getEnigma_tt() {
                if (!tt_enigma) {
                    console.log('Opening enigma session to temp target-copy app ' + tt_id);
                    tt_session = enigma.create({
                        schema,
                        url: config.wssUrl + tt_id,
                        createSocket: url => new WebSocket(url)
                    });
                    tt_global = await tt_session.open();
                    tt_enigma = await tt_global.openDoc(tt_id);
                }
            }
            async function closeEnigma_os() {
                if (os_session) {
                    console.log('Closing enigma session to source app ' + os_id);
                    await os_session.close();
                    os_session = null;
                    os_global = null;
                    os_enigma = null;
                };
            }
            async function closeEnigma_ts() {
                if (ts_session) {
                    console.log('Closing enigma session to temp source-copy app ' + ts_id);
                    await ts_session.close();
                    ts_session = null;
                    ts_global = null;
                    ts_enigma = null;
                };
            }
            async function closeEnigma_ot() {
                if (ot_session) {
                    console.log('Closing enigma session to target app ' + ot_id);
                    await ot_session.close();
                    ot_session = null;
                    ot_global = null;
                    ot_enigma = null;
                };
            }
            async function closeEnigma_tt() {
                if (tt_session) {
                    console.log('Closing enigma session to temp target-copy app ' + tt_id);
                    await tt_session.close();
                    tt_session = null;
                    tt_global = null;
                    tt_enigma = null;
                };
            }
            async function getOtSheets() {
                // gets a list of sheets of the OT app (original target) organized in an array
                var sheetList = {};
                const res = await qrsCall('GET', config.qrsUrl + "app/object?filter=objectType eq 'sheet' and app.id eq " + ot_id, httpHeader);
                for (var s = 0; s < res.length; s++) {
                    sheetList[res[s].id] = res[s].name;
                }
                console.log('sheetList before', sheetList)
                return sheetList;
            }
            async function cleanUpSheets(shListBefore) {
                // function deletes each sheet that is now in the app which is 
                // not in the shListBefore object. Only exception is, if the sheet
                // description contains the same {tag} (in angular brackets) that
                // the app title has. If the app title has no {tag} in angular 
                // brackets, this exception will not fire and any new sheet be removed
                var shListAfter = {};
                var appTitle = await qrsCall('GET', config.qrsUrl + "app/" + ot_id, httpHeader);
                var appTitle = appTitle.name;
                var appTag = appTitle.split('{')[1].split('}')[0];
                if (appTag.length > 0) appTag = '{' + appTag + '}';
                // console.log('appTitle', appTitle, 'appTag', appTag);
                const res = await qrsCall('GET', config.qrsUrl + "app/object?filter=objectType eq 'sheet' and app.id eq " + ot_id, httpHeader);
                for (var s = 0; s < res.length; s++) {
                    shListAfter[res[s].id] = {
                        name: res[s].name,
                        description: res[s].description
                    };
                }
                // console.log('sheetList after', shListAfter);
                for (const objId in shListAfter) {
                    if (!shListBefore.hasOwnProperty(objId)) {
                        if (appTag.length > 0 && shListAfter[objId].description.indexOf(appTag) > -1) {
                            console.log('Sheet "' + shListAfter[objId].name + '" is new but tagged for this app. Keeping.');
                        } else {
                            console.log('Sheet "' + shListAfter[objId].name + '" is new. Deleting ' + objId);
                            await qrsCall('DELETE', config.qrsUrl + "app/object/" + objId, httpHeader);
                        }
                    }
                }
            }

            // iterate through the steps found in DOM model 
            for (var i = 0; i < steps.length; i++) {
                //$('#steplist_parent tr').each(async function (i, e) {
                const step = steps[i];
                var res;
                // next app, reset variables
                if (step.nextApp > 0) {
                    console.log('--next app--');
                    //if (os_session) { await os_session.close() };
                    //if (ts_session) { await ts_session.close() };
                    if (ot_session) { await ot_session.close() };
                    if (tt_session) { await tt_session.close() };
                    // os_id remains unchanged
                    // oss remains unchanged;
                    // ts_id remains unchanged;
                    // tss remains unchanged;
                    tt_id = null;
                    tts = null;
                    ot_id = step.trgtAppId;
                    ots = null;
                    ot_sh = null;
                }

                console.log('step ' + step.number, step.actionId, 'trgt', ot_id);
                $('#stepscounter').text('(' + step.number + ' of ' + steps.length + ')');
                $('#step' + step.number + ' svg').addClass('busy');
                if ($('#step' + step.number).length > 0) {
                    // scroll the current step into focus
                    document.getElementById('step' + step.number).scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
                }

                try {

                    // to understand the flow best, see this flow diagram:
                    // https://raw.githubusercontent.com/ChristofSchwarz/db_mash_databridgehub/main/pics/actionflow.png

                    switch (step.actionId) {
                        //------------------------------------------------------------------------
                        case 'cos': //Copy source app as temp source-copy
                            res = await qrsCall('POST', config.qrsUrl + 'app/' + os_id + '/copy', httpHeader);
                            ts_id = res.id;
                            break;
                        //------------------------------------------------------------------------
                        case 'cot': //Copy target app as temp target-copy
                            res = await qrsCall('POST', config.qrsUrl + 'app/' + ot_id + '/copy', httpHeader);
                            tt_id = res.id;
                            break;
                        //------------------------------------------------------------------------
                        case 'dts': //Delete temp source-copy
                            await closeEnigma_ts();
                            res = await qrsCall('DELETE', config.qrsUrl + 'app/' + ts_id, httpHeader);
                            break;
                        //------------------------------------------------------------------------
                        case 'dtt': //Delete temp target-copy
                            await closeEnigma_tt();
                            res = await qrsCall('DELETE', config.qrsUrl + 'app/' + tt_id, httpHeader);
                            break;
                        //------------------------------------------------------------------------
                        case 'goss': //Get script of original source app
                            await getEnigma_os();
                            oss = await os_enigma.getScript();
                            break;
                        //------------------------------------------------------------------------
                        case 'gots': //Get script of original target
                            await getEnigma_ot();
                            ots = await ot_enigma.getScript();
                            break;
                        //------------------------------------------------------------------------
                        case 'gtss': //Get script of temp source-copy
                            await getEnigma_ts();
                            tss = await ts_enigma.getScript();
                            break;
                        //------------------------------------------------------------------------
                        case 'gtts': //Get script of temp target-copy
                            await getEnigma_tt();
                            tts = await tt_enigma.getScript();
                            break;
                        //------------------------------------------------------------------------
                        case 'os2ot': //Source app replaces target app
                            if (noNewSheets) ot_sh = await getOtSheets();
                            await qrsCall('PUT', config.qrsUrl + 'app/' + os_id + '/replace?app=' + ot_id, httpHeader);
                            if (noNewSheets) await cleanUpSheets(ot_sh);
                            break;
                        //------------------------------------------------------------------------
                        case 'osd2tt': //Copy source data to target copy (binary)
                            await getEnigma_tt();
                            await tt_enigma.setScript('BINARY [lib://' + settings.dataConnection + '/' + os_id + '];');
                            await tt_enigma.doSave();
                            await tt_enigma.doReload();
                            await tt_enigma.doSave();
                            break;
                        //------------------------------------------------------------------------
                        case 'oss2ot': //Copy source script to target
                            await getEnigma_ot();
                            await ot_enigma.setScript(oss);
                            await ot_enigma.doSave();
                            break;
                        //------------------------------------------------------------------------
                        case 'oss2tt': //Copy source script to target-copy
                            await getEnigma_tt();
                            await tt_enigma.setScript(oss);
                            await tt_enigma.doSave();
                            break;
                        //------------------------------------------------------------------------
                        case 'otd2ts': //Copy target data to source-copy (binary)
                            await getEnigma_ts();
                            await ts_enigma.setScript('BINARY [lib://' + settings.dataConnection + '/' + ot_id + '];');
                            await ts_enigma.doSave();
                            await ts_enigma.doReload();
                            await ts_enigma.doSave();
                            break;
                        //------------------------------------------------------------------------
                        case 'otr': //Source app replaces target app
                            await qrsCall('POST', config.qrsUrl + 'app/' + ot_id + '/reload', httpHeader);
                            break;
                        //------------------------------------------------------------------------
                        case 'ottag': //Set tags of original target app
                            //console.log('ottag: addTag', addTag, 'removeTag', removeTag);
                            var otInfo = await qrsCall('GET', config.qrsUrl + "app/" + ot_id, httpHeader);
                            //console.log('Tags before', otInfo.tags);
                            var newTags = [];
                            var alreadyInTags = false;
                            for (var t = 0; t < otInfo.tags.length; t++) {
                                if (otInfo.tags[t].name != removeTag) newTags.push({ id: otInfo.tags[t].id });
                                if (otInfo.tags[t].name == addTag) alreadyInTags = true;
                            };
                            if (!alreadyInTags && addTag) {
                                var addTagId = await qrsCall('GET', config.qrsUrl + "tag?filter=name eq '" + addTag + "'", httpHeader);
                                if (addTagId.length > 0) {
                                    addTagId = addTagId[0].id;
                                    console.log('add existing tag ' + addTag, addTagId);
                                } else {
                                    addTagId = await qrsCall('POST', config.qrsUrl + "tag", httpHeader, JSON.stringify({ name: addTag }));
                                    addTagId = addTagId.id;
                                    console.log('add new tag ' + addTag, addTagId);
                                }
                                newTags.push({ id: addTagId });
                            }
                            //console.log('Tags after', newTags);
                            await qrsCall('PUT', config.qrsUrl + "app/" + ot_id, httpHeader,
                                JSON.stringify({ modifiedDate: "2199-12-31T23:59:59.999Z", tags: newTags }));
                            break;
                        //------------------------------------------------------------------------
                        case 'ots2ts': //Copy target script to source-copy
                            await getEnigma_ts();
                            await ts_enigma.setScript(ots);
                            await ts_enigma.doSave();
                            break;
                        //------------------------------------------------------------------------
                        case 'rtss': //Revert script of temp source app
                            if (!ts_enigma) { alert('Enigma session ts_enigma must be open by now.'); return false; }
                            await ts_enigma.setScript(tss);
                            await ts_enigma.doSave();
                            break;
                        //------------------------------------------------------------------------
                        case 'rtts': //Revert script of temp target app
                            if (!tt_enigma) { alert('Enigma session tt_enigma must be open by now.'); return false; }
                            await tt_enigma.setScript(tts);
                            await tt_enigma.doSave();
                            break;
                        //------------------------------------------------------------------------
                        case 'ts2ot': //Temp source copy replaces target app
                            if (noNewSheets) ot_sh = await getOtSheets();
                            await qrsCall('PUT', config.qrsUrl + 'app/' + ts_id + '/replace?app=' + ot_id, httpHeader);
                            if (noNewSheets) await cleanUpSheets(ot_sh);
                            break;
                        //------------------------------------------------------------------------
                        case 'tsd2tt': //Copy source-copy's data to target copy (binary)
                            await getEnigma_tt();
                            await tt_enigma.setScript('BINARY [lib://' + settings.dataConnection + '/' + ts_id + '];');
                            await tt_enigma.doSave();
                            await tt_enigma.doReload();
                            await tt_enigma.doSave();
                            break;
                        //------------------------------------------------------------------------
                        case 'tss2ot': //Copy source-copy's script to target
                            await getEnigma_ot();
                            await ot_enigma.setScript(tss);
                            await ot_enigma.doSave();
                            break;
                        //------------------------------------------------------------------------
                        case 'tss2tt': //Copy source-copy's script to target-copy
                            await getEnigma_tt();
                            await tt_enigma.setScript(tss);
                            await tt_enigma.doSave();
                            break;
                        //------------------------------------------------------------------------
                        case 'tt2ot': //Temp target-copy replaces target app
                            if (noNewSheets) ot_sh = await getOtSheets();
                            await qrsCall('PUT', config.qrsUrl + 'app/' + tt_id + '/replace?app=' + ot_id, httpHeader);
                            if (noNewSheets) await cleanUpSheets(ot_sh);
                            break;
                        //------------------------------------------------------------------------
                        case 'tts2ts': //Copy target-copy's script to source-copy
                            //console.log('tts2ts', tts.substr(0,100), ts_id);
                            await getEnigma_ts();
                            await ts_enigma.setScript(tts);
                            await ts_enigma.doSave();
                            break;
                        //------------------------------------------------------------------------
                        case 'uts': //Upload app as temp source-copy
                            const newApp = await uploadApp(from, config, httpHeader);
                            ts_id = newApp.id;
                            break;
                        //------------------------------------------------------------------------
                        default:
                            $('#step' + step.number + ' svg').removeClass('busy');
                            $('#step' + step.number + ' .checkfailed').show();
                            alert('no function for action "' + step.actionId + '" programmed.');
                            return (false);
                            break;
                    }
                }
                catch (err) {
                    $('#step' + step.number + ' svg').removeClass('busy');
                    $('#step' + step.number + ' .checkfailed').show();
                    alert(err);
                    return false;
                }
                $('#step' + step.number + ' svg').removeClass('busy');
                $('#step' + step.number + ' .checktick').show();
            };
            await closeEnigma_os();
            await closeEnigma_ts();
            await closeEnigma_tt();
            await closeEnigma_ot();
        },
        //=============================================================================================

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
        },

        //=============================================================================================

        reloadApp: async function (appId, config, httpHeader) {
            // reloads the app and shows a dialog with progress
            const ownId = 'reloadProgress';
            luiDialog(ownId, 'Progress',
                '<div id="spinningwheel">&nbsp;</div>'
                + '<div id="' + ownId + '_rldtxt"><br/>Reloading app in background (if you close it will continue)...<hr /></div>'
                + 'Status: <span id="' + ownId + '_rldstat">...</span>'
                + '<button class="lui-button" style="float:right;display:none;" id="' + ownId + 'downloadbtn'
                + '">download now</button>', 'Close', null, false);
            var res1 = await qrsCall('POST', config.qrsUrl + 'app/' + appId + '/reload', httpHeader);

            // Watch progress of reload
            var timer;
            var watchThisTask;
            $('#msgok_' + ownId).on('click', function () {
                // button Close clicked, stop watching
                clearInterval(timer);
                $('#msgparent_' + ownId).remove();
            });


            // get list of "Manually" tasks for this app
            var tasks = await qrsCall('GET', config.qrsUrl + "reloadtask?filter=name sw 'Manually' and app.id eq " + appId, httpHeader);
            var startTimer = Date.now();
            if (tasks.length == 1) {
                watchThisTask = tasks[0].id;
                timer = setInterval(checkTaskProgress, 3000, watchThisTask);
            } else {
                $('#' + ownId + '_rldstat').text('multiple tasks found, cannot check status.');
            }
            // text codes for the statuses
            var statusList = ('0;1;<reload> Running;3;4;5;6;<tick> Finished;<warning> Failed')
                .replace(/</g, '<span class="lui-icon  lui-icon--').replace(/>/g, '"></span>').split(';');

            function checkTaskProgress(watchThisTask) {
                var timeSince = Math.round((Date.now() - startTimer) / 1000);
                timeSince = (timeSince > 59 ? Math.floor(timeSince / 60) : 0) + ':' + ('0' + (timeSince % 60)).slice(-2);
                $('#' + ownId + '_rldstat').text('');
                qrsCall('GET', config.qrsUrl + "reloadtask/" + watchThisTask, httpHeader)
                    .then(function (task) {
                        if (task.operational && task.operational.lastExecutionResult) {
                            var status = task.operational.lastExecutionResult.status;
                            if (statusList[status]) status = statusList[status];
                            $('#' + ownId + '_rldstat').html(status + ' (' + timeSince + ')');

                            if (task.operational.lastExecutionResult.duration > 0) {
                                clearInterval(timer);
                                $('#' + ownId + '_rldtxt').remove();
                                $('#spinningwheel').remove();
                            }
                        }
                    });
            }


        }
    };


    //=========================================================================================    
    function luiDialog(ownId, title, detail, ok, cancel, inverse, width) {
        // This html was found on https://qlik-oss.github.io/leonardo-ui/dialog.html

        var node = document.createElement("div");
        node.id = "msgparent_" + ownId;
        var html =
            '  <div class="lui-modal-background"></div>' +
            '  <div class="lui-dialog' + (inverse ? '  lui-dialog--inverse' : '') + '" style="width: ' + (width ? width : 400) + 'px;top:80px;">' +
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
        const logQrsCommunication = headerParam["X-qrsApiConsoleLog"];
        try {
            var headersPriv = JSON.parse(JSON.stringify(headerParam));
            delete headersPriv["X-qrsApiConsoleLog"];  // remove pseudo header, this info is just for this function

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
