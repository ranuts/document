(function(){

    var LOADED_STATUS = false;

    var currentScriptSrc = document.currentScript ? document.currentScript.src : location.href;
    var currentScriptDirectory = currentScriptSrc;
    currentScriptDirectoryIndex = currentScriptDirectory.lastIndexOf("/");
    if (currentScriptDirectoryIndex != -1)
        currentScriptDirectory = currentScriptDirectory.substr(0, currentScriptDirectoryIndex);

    var userAgent = navigator && navigator.userAgent ? navigator.userAgent.toLowerCase() : "";
    var isIE = /msie|trident/i.test(userAgent);

    var monacoFolderName = isIE ? "monaco-for-ie" : "monaco";
    var LOADIND_LOCAL = {
        URL : "./" + monacoFolderName + "/min/vs/loader.js",
        WORKER : function(moduleId, label) {
            return currentScriptDirectory + "/" + monacoFolderName + "/min/vs/base/worker/workerMain.js";
        },
        BASE_VS : currentScriptDirectory + "/" + monacoFolderName + "/min/vs"
    };

    var LOADING = LOADIND_LOCAL;

    var REGISTERED_EDITORS = [];

    function MonacoEditor()
    {
        this.parent = "";
        this.theme = "";
        this.value = "";
        this.options = {};

        this.editor = null;
        this.libraries = [];
        this.events = [];
    }

    MonacoEditor.prototype.create = function(parent, theme, value, options, callback) {
        this.parent = parent;
        this.theme = theme || "vs-light";
        this.value = value || "";
        this.options = options || {};
        this.readyCallback = callback;

        if (!LOADED_STATUS) {
            REGISTERED_EDITORS.push(this);
            return;
        }

        this._create();
    };

    MonacoEditor.prototype._create = function() {
        let options = {
            value: this.value,
            language: "javascript",
            theme: this.theme ? this.theme : "vs-light",
            automaticLayout: true,
            domReadOnly: true,
            suggest: {
                preview: false,
                showInlineDetails: true
            }
        };
        for (let i in this.options)
            options[i] = this.options[i];

        this._registerLanguage(options.language);
        this.editor = monaco.editor.create(document.getElementById(this.parent), options);
        this._loadLibraries();
        this._loadEvents();
        this.readyCallback && this.readyCallback.call();
    };

    MonacoEditor.prototype.setTheme = function(theme) {
        this.theme = theme;

        if (this.editor) {
            monaco.editor.setTheme(this.theme);
        }
    };

    MonacoEditor.prototype.setValue = function(value) {
        this.value = value;

        if (this.editor) {
            this.editor.setValue(this.value);
        }
    };

    MonacoEditor.prototype.getValue = function(value) {
        return this.editor ? this.editor.getValue() : "";
    };

    MonacoEditor.prototype.addLibrary = function(lib) {
        this.libraries.push(lib);
        if (!this.editor)
            return;
        
        this._loadLibraries();
    };

    MonacoEditor.prototype._loadLibraries = function() {
        let libraries = [];
        for (let i = 0, len = this.libraries.length; i < len; i++) {
            try {
                var xhrObj = new XMLHttpRequest();
                if ( xhrObj )
                {
                    xhrObj.open("GET", this.libraries[i].url, false);
                    xhrObj.send("");

                    libraries.push({
                        name : this.libraries[i].name,
                        code : xhrObj.responseText
                    })
                }
            }
            catch (e) {}
        }

        for (let i = 0, len = libraries.length; i < len; i++) {
            monaco.languages.typescript.javascriptDefaults.addExtraLib(libraries[i].code, libraries[i].name);
        }
    };

    MonacoEditor.prototype._registerLanguage = function(language) {
        if(language == 'vba') {
            monaco.languages.register({ id: 'vba' });
            monaco.languages.setMonarchTokensProvider('vba', {
                tokenizer: {
                    root: [
                        [/\b(?:Sub|End Sub|Function|End Function|If|Then|Else|End If|Dim|As|Set|New|For|Each|Next|Do|Loop|While|Wend|Select Case|Case|End Select|Exit|With|End With|Call|Private|Public|Const|GoTo|On Error)\b/, 'keyword'],
                        [/"([^"]*)"/, 'string'],
                        [/\b[A-Za-z_][A-Za-z0-9_]*\b/, 'identifier'],
                        [/\d+/, 'number'],
                        [/'.*$/, 'comment']
                    ]
                }
            });
        }
    };
    
    MonacoEditor.prototype.dispose = function() {
        for (let i = 0; i < REGISTERED_EDITORS.length; i++) {
            if (this === REGISTERED_EDITORS[i])
                REGISTERED_EDITORS.splice(i, 1);
        }

        if (this.editor) {
            this.editor.dispose();
            this.editor = null;
        }            
    };


    MonacoEditor.prototype.setPosition = function(position) {
        if (this.editor) {
            this.editor.setPosition(position);
        }
    };

    MonacoEditor.prototype.getPosition = function() {
        return this.editor ? this.editor.getPosition() : {lineNumber: 0, column: 0};
    };

    MonacoEditor.prototype.setFocus = function() {
        this.editor && this.editor.focus();
    };

    MonacoEditor.prototype.setReadonly = function(value) {
        this.editor && this.editor.updateOptions({readOnly: value});
    };

    MonacoEditor.prototype.revealPositionInCenter = function() {
        this.editor && this.editor.revealPositionInCenter(this.editor.getPosition());
    };

    MonacoEditor.prototype.undo = function() {
        this.editor && this.editor.trigger("codeEditor", "undo");
    };

    MonacoEditor.prototype.redo = function() {
        this.editor && this.editor.trigger("codeEditor", "redo");
    };

    MonacoEditor.prototype._loadEvents = function() {
        while (this.events.length>0) {
            let event = this.events.shift();
            this.editor[event.event](event.handler);
        }
    };

    MonacoEditor.prototype.on = function(event, handler, scope) {
        this.events.push({
            event: event,
            handler: function() {
                handler.call(scope);
            }
        });
        if (!this.editor) return;

        this._loadEvents();
    };

    window.MonacoEnvironment = {
        getWorkerUrl: function (moduleId, label) {
            return LOADING.WORKER(moduleId, label);
        }
    };

    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = LOADING.URL;
    script.onload = function(){
        require.config({
            paths: {
                "vs": LOADING.BASE_VS
            }
        });
        
        require(["vs/editor/editor.main"], function () {
            LOADED_STATUS = true;

            for (let i = 0; i < REGISTERED_EDITORS.length; i++) {
                REGISTERED_EDITORS[i]._create();
            }

            REGISTERED_EDITORS = [];
        });
    };
    script.onerror = function(){
        console.log("Error loading monaco editor!");
    };
    document.head.appendChild(script);

    window.MonacoEditor = MonacoEditor;

})();
