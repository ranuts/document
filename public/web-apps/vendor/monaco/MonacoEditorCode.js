/*
 * (c) Copyright Ascensio System SIA 2010-2024
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation. In accordance with
 * Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement
 * of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR  PURPOSE. For
 * details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA at 20A-6 Ernesta Birznieka-Upish
 * street, Riga, Latvia, EU, LV-1050.
 *
 * The  interactive user interfaces in modified source and object code versions
 * of the Program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU AGPL version 3.
 *
 * Pursuant to Section 7(b) of the License you must retain the original Product
 * logo when distributing the program. Pursuant to Section 7(e) we decline to
 * grant you any rights under trademark law for use of our trademarks.
 *
 * All the Product's GUI elements, including illustrations and icon sets, as
 * well as technical writing content are licensed under the terms of the
 * Creative Commons Attribution-ShareAlike 4.0 International. See the License
 * terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 */

var codeEditor = new window.MonacoEditor();
codeEditor.create("editor", window.editorTheme === "dark" ? "vs-dark" : "vs-light", "", {
    minimap: {
        enabled: false
    },
    language: window.language
}, function() {
    _postMessage({
        command: 'monacoEditorReady',
    });
});

if(window.language == 'javascript') {
    codeEditor.addLibrary({
        url: "./libs/" + window.editorType + "/api.js",
        name : "onlyoffice"
    });
}

var _postMessage = function(msg) {
    if(window.parent && window.JSON) {
        msg.referer = 'monaco-editor-' + window.id;
        window.parent.postMessage(window.JSON.stringify(msg), "*");
    }
};

(function (window, undefined) {
    var _dropDisabled = undefined;

    codeEditor.on('onDidChangeModelContent', function(event) {
        if (window.isDisable) return;
        var pos = codeEditor.getPosition();
        _postMessage({
            command: 'changeValue',
            data: { value: codeEditor.getValue(), pos: {row: pos.lineNumber, column: pos.column} },
        });
    });

    var editorSetValue = function(data) {
        window.isDisable = true;
        codeEditor.setValue(data.value || '');
        codeEditor.setPosition({lineNumber: data.currentPos ? data.currentPos.row : 0, column: data.currentPos ? data.currentPos.column : 0});
        codeEditor.setReadonly(!!data.readonly);
        codeEditor.setFocus();
        window.isDisable = false;
    };

    var editorDisableDrop = function(disable) {
        if (_dropDisabled===undefined) {
            var el = document.getElementById('editor');
            el.ondrop = function(e) {
                if (!_dropDisabled) return;
                if (e && e.preventDefault)
                    e.preventDefault();
                return false;
            };
            el.ondragenter = function(e) {
                if (!_dropDisabled) return;
                if (e && e.preventDefault)
                    e.preventDefault();
                return false;
            };
            el.ondragover = function(e) {
                if (!_dropDisabled) return;
                if (e && e.preventDefault)
                    e.preventDefault();
                if (e && e.dataTransfer)
                    e.dataTransfer.dropEffect = "none";
                return false;
            };
        }
        _dropDisabled = disable;
    };

    var onThemeChanged = function(colors) {
        if (!colors) return;

        if (colors.type === 'dark')
            codeEditor.setTheme("vs-dark");
        else
            codeEditor.setTheme("vs-light");

    };

    var _onMessage = function(msg) {
        var data = msg.data;
        if (Object.prototype.toString.apply(data) !== '[object String]' || !window.JSON) {
            return;
        }
        var cmd, handler;

        try {
            cmd = window.JSON.parse(data)
        } catch(e) {
            cmd = '';
        }

        if (cmd && cmd.referer == "monaco-editor-" + window.id) {
            if (cmd.command==='setValue') {
                editorSetValue(cmd.data);
            } else if (cmd.command==='setTheme') {
                onThemeChanged(cmd.data);
            }else if (cmd.command==='disableDrop') {
                editorDisableDrop(cmd.data);
            } else if(cmd.command==='revealPositionInCenter') {
                codeEditor.revealPositionInCenter();
            } else if(cmd.command==='undo') {
                codeEditor.undo();
            } else if(cmd.command==='redo') {
                codeEditor.redo();
            } 
        }
    };

    var fn = function(e) { _onMessage(e); };
    if (window.attachEvent) {
        window.attachEvent('onmessage', fn);
    } else {
        window.addEventListener('message', fn, false);
    }

    var _onResize = function() {
        var styleTag = document.getElementById('dynamic-styles');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'dynamic-styles';
            document.head.appendChild(styleTag);
        }
        //Calculate tooltip height(20px - height text row)
        var maxHeight = Math.min((window.innerHeight - 20) / 2, 250);
        var content = '.monaco-hover { max-height:' + maxHeight + 'px !important; }';
        content += '.scrollbar, .scrollbar .slider { pointer-events: auto !important; }';
        styleTag.textContent = content;
    };

    _onResize();
    window.addEventListener('resize', _onResize);
})(window, undefined);