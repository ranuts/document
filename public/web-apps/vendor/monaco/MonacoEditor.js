(function(window, document) {
    /*
    * config = {
    *   editorType: 'cell'/'slide'/'word',
    *   language: 'javascript'/'vba'
    *   events: {
    *       onChangeValue // text in editor is changed
    *       onEditorReady // editor is ready for use
    *       onLoad // frame with editor is loaded
    *   }
    * }
    * */
    
    window.MonacoEditorWrapper = function(placeholderId, config) {
        var _self = this,
            _config = config || {},
            _id = Math.random().toString(16).slice(2),
            parentEl = document.getElementById(placeholderId),
            iframe;

        var _setValue = function(value, currentPos, readonly) {
            _postMessage(iframe.contentWindow, _id, {
                command: 'setValue',
                data: {
                    value: value,
                    currentPos: currentPos
                }
            });
        };

        var _updateTheme = function(type) {
            _postMessage(iframe.contentWindow, _id, {
                command: 'setTheme',
                data: {
                    type: type
                }
            });
        };

        var _disableDrop = function(disable) {
            _postMessage(iframe.contentWindow, _id, {
                command: 'disableDrop',
                data: disable
            });
        };

        var _destroyEditor = function() {
            if (iframe) {
                _msgDispatcher && _msgDispatcher.unbindEvents();
                iframe.parentNode && iframe.parentNode.removeChild(iframe);
            }
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

            if (cmd && cmd.referer == "monaco-editor-" + _id) {
                var events = _config.events || {},
                    handler;
                data = {};
                switch (cmd.command) {
                    case 'changeValue':
                        handler = events['onChangeValue'];
                        data = cmd.data;
                        break;
                    case 'monacoEditorReady':
                        handler = events['onEditorReady'];
                        data = cmd.data;
                        break;
                }
                if (handler && typeof handler == "function") {
                    res = handler.call(_self, {target: _self, data: data});
                }
            }
        };


        var _onLoad = function() {
            _config.theme && _updateTheme(_config.theme);

            var handler = (_config.events || {})['onLoad'];
            if (handler && typeof handler == "function") {
                res = handler.call(_self);
            }
        };

        if (parentEl) {
            iframe = createIframe(_id, _config);
            iframe.onload = _onLoad;
            var _msgDispatcher = new MessageDispatcher(_onMessage, this);
            parentEl.appendChild(iframe);
        }

        return {
            setValue: _setValue, // string // set text to editor
            disableDrop: _disableDrop, // true/false // disable/enable drop elements to editor
            destroyEditor: _destroyEditor,
            updateTheme: _updateTheme // type: 'dark'/'light'
        }
    }

    function getBasePath() {
        var scripts = document.getElementsByTagName('script'),
            match;

        for (var i = scripts.length - 1; i >= 0; i--) {
            match = scripts[i].src.match(/(.*)MonacoEditor.js/i);
            if (match) {
                return match[1];
            }
        }

        return "";
    }

    function createIframe(id, config) {
        var params = [];
        config.editorType && params.push('editorType=' + config.editorType);
        config.theme && params.push('editorTheme=' + config.theme);
        config.language && params.push('language=' + config.language);
        id && params.push('id=' + id);

        iframe = document.createElement("iframe");
        iframe.width        = '100%';
        iframe.height       = '100%';
        iframe.align        = "top";
        iframe.frameBorder  = 0;
        iframe.scrolling    = "no";
        iframe.src = getBasePath() + 'MonacoEditor.html' + (params.length ? '?' + params.join('&') : '');

        return iframe;
    }

    function _postMessage(wnd, id, msg) {
        if (wnd && wnd.postMessage && window.JSON) {
            msg.referer = 'monaco-editor-' + id;
            wnd.postMessage(window.JSON.stringify(msg), "*");
        }
    }

    MessageDispatcher = function(fn, scope) {
        var _fn     = fn,
            _scope  = scope || window,
            eventFn = function(msg) {
                _fn.call(_scope, msg);
            };

        var _bindEvents = function() {
            if (window.addEventListener) {
                window.addEventListener("message", eventFn, false)
            }
            else if (window.attachEvent) {
                window.attachEvent("onmessage", eventFn);
            }
        };

        var _unbindEvents = function() {
            if (window.removeEventListener) {
                window.removeEventListener("message", eventFn, false)
            }
            else if (window.detachEvent) {
                window.detachEvent("onmessage", eventFn);
            }
        };

        _bindEvents.call(this);

        return {
            unbindEvents: _unbindEvents
        }
    };

})(window, document);
