(function () {
    'use strict';

    if (typeof window.AscCommon === 'undefined') {
        window.AscCommon = {};
    }

    function DataTypeChecker() {

        this.isUint8Array = function (data) {
            return data instanceof Uint8Array;
        };

        this.isTypedArray = function (data) {
            return data instanceof Int8Array ||
                data instanceof Uint8Array ||
                data instanceof Uint8ClampedArray ||
                data instanceof Int16Array ||
                data instanceof Uint16Array ||
                data instanceof Int32Array ||
                data instanceof Uint32Array ||
                data instanceof Float32Array ||
                data instanceof Float64Array ||
                data instanceof BigInt64Array ||
                data instanceof BigUint64Array;
        };

        this.isArrayBuffer = function (data) {
            return data instanceof ArrayBuffer;
        };

        this.isBlob = function (data) {
            return data instanceof Blob;
        };

        this.isFile = function (data) {
            return data instanceof File;
        };

        this.isBinaryData = function (data) {
            return this.isTypedArray(data) ||
                this.isArrayBuffer(data) ||
                this.isBlob(data) ||
                this.isFile(data);
        };

        this.isURL = function (data) {
            if (typeof data !== 'string' || !data.trim()) {
                return false;
            }

            try {
                new URL(data);
                return true;
            } catch (e) {
                return false;
            }
        };

        this.isHttpURL = function (data) {
            if (!this.isURL(data)) return false;

            var url = data.toLowerCase().trim();
            return url.startsWith('http://') || url.startsWith('https://');
        };

        this.isDataURL = function (data) {
            if (typeof data !== 'string' || !data.trim()) {
                return false;
            }

            var dataUrlPattern = /^data:([a-zA-Z0-9][a-zA-Z0-9\/+\-]*);base64,([A-Za-z0-9+/]+=*)$/;
            return dataUrlPattern.test(data.trim());
        };

        this.isBlobURL = function (data) {
            if (typeof data !== 'string' || !data.trim()) {
                return false;
            }

            return data.toLowerCase().trim().startsWith('blob:');
        };

        this.isFileURL = function (data) {
            if (typeof data !== 'string' || !data.trim()) {
                return false;
            }

            return data.toLowerCase().trim().startsWith('file://');
        };

        this.getDataType = function (data) {
            if (data === null) return 'null';
            if (data === undefined) return 'undefined';

            if (this.isFile(data)) return 'File';
            if (this.isBlob(data)) return 'Blob';
            if (this.isArrayBuffer(data)) return 'ArrayBuffer';
            if (this.isUint8Array(data)) return 'Uint8Array';
            if (data instanceof Int8Array) return 'Int8Array';
            if (data instanceof Uint8ClampedArray) return 'Uint8ClampedArray';
            if (data instanceof Int16Array) return 'Int16Array';
            if (data instanceof Uint16Array) return 'Uint16Array';
            if (data instanceof Int32Array) return 'Int32Array';
            if (data instanceof Uint32Array) return 'Uint32Array';
            if (data instanceof Float32Array) return 'Float32Array';
            if (data instanceof Float64Array) return 'Float64Array';
            if (data instanceof BigInt64Array) return 'BigInt64Array';
            if (data instanceof BigUint64Array) return 'BigUint64Array';

            if (typeof data === 'string') {
                if (this.isDataURL(data)) return 'DataURL';
                if (this.isBlobURL(data)) return 'BlobURL';
                if (this.isFileURL(data)) return 'FileURL';
                if (this.isHttpURL(data)) return 'HttpURL';
                if (this.isURL(data)) return 'URL';
                return 'String';
            }

            return typeof data;
        };

        this.isBinaryDataOrURL = function (data) {
            return this.isBinaryData(data) || this.isURL(data);
        };

        this.getDataSize = function (data) {
            if (this.isFile(data) || this.isBlob(data)) {
                return data.size;
            }
            if (this.isArrayBuffer(data)) {
                return data.byteLength;
            }
            if (this.isTypedArray(data)) {
                return data.byteLength;
            }
            if (typeof data === 'string') {
                return new Blob([data]).size;
            }
            return 0;
        };

        this.formatDataSize = function (bytes) {
            if (bytes === 0) return '0 Bytes';

            var k = 1024;
            var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            var i = Math.floor(Math.log(bytes) / Math.log(k));

            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        this.isValidData = function (data) {
            if (data === null || data === undefined) {
                return false;
            }

            if (this.isBinaryData(data)) {
                return this.getDataSize(data) > 0;
            }

            if (typeof data === 'string') {
                return data.trim().length > 0;
            }

            return true;
        };
    }

    var dataTypeChecker = new DataTypeChecker();

    function isUint8Array(data) {
        return dataTypeChecker.isUint8Array(data);
    }

    function isTypedArray(data) {
        return dataTypeChecker.isTypedArray(data);
    }

    function isBinaryData(data) {
        return dataTypeChecker.isBinaryData(data);
    }

    function isURL(data) {
        return dataTypeChecker.isURL(data);
    }

    function isHttpURL(data) {
        return dataTypeChecker.isHttpURL(data);
    }

    function isDataURL(data) {
        return dataTypeChecker.isDataURL(data);
    }

    function isBlobURL(data) {
        return dataTypeChecker.isBlobURL(data);
    }

    function getDataType(data) {
        return dataTypeChecker.getDataType(data);
    }

    function isBinaryDataOrURL(data) {
        return dataTypeChecker.isBinaryDataOrURL(data);
    }

    function handleFileData(data) {
        var type = getDataType(data);

        return new Promise(function (resolve, reject) {
            switch (type) {
                case 'Uint8Array':
                    resolve(data);
                    break;

                case 'File':
                    var reader = new FileReader();
                    reader.onload = function (e) {
                        var binaryData = new Uint8Array(e.target.result);
                        resolve(binaryData);
                    };
                    reader.onerror = function (e) {
                        reject(new Error('File read failed: ' + e.target.error));
                    };
                    reader.readAsArrayBuffer(data);
                    break;

                case 'Blob':
                    var blobReader = new FileReader();
                    blobReader.onload = function (e) {
                        var binaryData = new Uint8Array(e.target.result);
                        resolve(binaryData);
                    };
                    blobReader.onerror = function (e) {
                        reject(new Error('Blob read failed: ' + e.target.error));
                    };
                    blobReader.readAsArrayBuffer(data);
                    break;

                case 'ArrayBuffer':
                    resolve(new Uint8Array(data));
                    break;

                case 'HttpURL':
                    fetch(data)
                        .then(function (response) {
                            if (!response.ok) {
                                throw new Error('Fetch failed: ' + response.status + ' ' + response.statusText);
                            }
                            return response.arrayBuffer();
                        })
                        .then(function (arrayBuffer) {
                            resolve(new Uint8Array(arrayBuffer));
                        })
                        .catch(function (error) {
                            reject(new Error('URL download failed: ' + error.message));
                        });
                    break;

                case 'DataURL':
                    try {
                        var base64String = data.split(',')[1];
                        if (!base64String) {
                            throw new Error('Invalid Data URL');
                        }
                        var binaryString = atob(base64String);
                        var binaryData = new Uint8Array(binaryString.length);

                        for (var i = 0; i < binaryString.length; i++) {
                            binaryData[i] = binaryString.charCodeAt(i);
                        }

                        resolve(binaryData);
                    } catch (error) {
                        reject(new Error('Data URL resolve failed: ' + error.message));
                    }
                    break;

                case 'BlobURL':
                    fetch(data)
                        .then(function (response) {
                            if (!response.ok) {
                                throw new Error('Blob URL connection failed: ' + response.status);
                            }
                            return response.arrayBuffer();
                        })
                        .then(function (arrayBuffer) {
                            resolve(new Uint8Array(arrayBuffer));
                        })
                        .catch(function (error) {
                            reject(new Error('Blob URL handle failed: ' + error.message));
                        });
                    break;

                case 'FileURL':
                    fetch(data)
                        .then(function (response) {
                            if (!response.ok) {
                                throw new Error('File URL connection failed: ' + response.status);
                            }
                            return response.arrayBuffer();
                        })
                        .then(function (arrayBuffer) {
                            resolve(new Uint8Array(arrayBuffer));
                        })
                        .catch(function (error) {
                            reject(new Error('File URL failed: ' + error.message));
                        });
                    break;

                case 'Int8Array':
                case 'Uint8ClampedArray':
                case 'Int16Array':
                case 'Uint16Array':
                case 'Int32Array':
                case 'Uint32Array':
                case 'Float32Array':
                case 'Float64Array':
                case 'BigInt64Array':
                case 'BigUint64Array':
                    resolve(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                    break;

                case 'String':
                    try {
                        var encoder = new TextEncoder();
                        resolve(encoder.encode(data));
                    } catch (error) {
                        reject(new Error('String encoding failed: ' + error.message));
                    }
                    break;

                default:
                    var errorMsg = 'Unsupported data type: ' + type;
                    console.error(errorMsg, data);
                    reject(new Error(errorMsg));
            }
        });
    }


    const PDF_OUTPUT_FORMAT = 513;
    const CANVAS_PDF_INPUT_FORMAT = 8196;
    const PDF_ORIGIN_PATH = '/working/origin.pdf';
    const PDF_OUTPUT_PATH = '/working/merged.pdf';
    const PDF_CHANGES_DIR = '/working/changes';
    const PDF_CHANGES_PATH = PDF_CHANGES_DIR + '/changes0.json';
    const PDF_PARAMS_PATH = '/working/pdf-params.xml';

    /**
     * Whether a status means "the server failed", as opposed to "the file is
     * not there". Only the first is worth asking again (see fetchWasmResponse).
     */
    function isTransientStatus(status) {
        return status >= 500 || status === 408 || status === 429;
    }

    function X2TConverter() {
        this.x2tModule = null;
        this.initPromise = null;
        this.hasScriptLoaded = false;
        // A streaming instantiation that failed. The hook cannot reject
        // loadScript() (that promise resolved when the <script> loaded, long
        // before the hook runs), so the failure is parked here and whoever is
        // waiting on doInitialize is told at once instead of sitting out
        // INIT_TIMEOUT. Sticky on purpose: x2t.js has already run its
        // createWasm in this frame and cannot be made to run another, so the
        // recovery is a new frame -- which is exactly what the editor's
        // open-failure retry builds.
        this.wasmInstantiateError = null;
        this.onWasmInstantiateError = null;
        this.SCRIPT_PATH = '../../../../sdkjs/common/wasm/x2t/x2t.js'
        // The raw x2t.wasm is ~40 MB, over Cloudflare Pages' 25 MiB per-file
        // deploy limit, so only the gzipped copy is shipped and decompressed
        // in the browser (see prepareWasmBinary).
        this.WASM_GZ_PATH = '../../../../sdkjs/common/wasm/x2t/x2t.wasm.gz'
        // Total tries for that fetch, and the step of the linear backoff
        // between them (0.5 s, then 1 s). Small on purpose: a CDN blip is over
        // in a moment, and anything longer is time the user spends watching a
        // spinner for a failure that is not going away.
        this.WASM_FETCH_ATTEMPTS = 3;
        this.WASM_FETCH_BACKOFF_MS = 500;
        this.binFileName = 'Editor.bin';

        this.DOCUMENT_TYPE_MAP = {
            docx: 'word',
            doc: 'word',
            odt: 'word',
            rtf: 'word',
            txt: 'word',
            pdf: 'pdf',
            xlsx: 'cell',
            xls: 'cell',
            ods: 'cell',
            csv: 'cell',
            pptx: 'slide',
            ppt: 'slide',
            odp: 'slide'
        };

        this.WORKING_DIRS = [
            '/working',
            '/working/media',
            '/working/fonts',
            '/working/themes'
        ];

        this.INIT_TIMEOUT = 60000;
    }

    X2TConverter.prototype.initialize = function () {
        if (this.x2tModule) {
            return Promise.resolve(this.x2tModule);
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.doInitialize();
        return this.initPromise;
    };
    // Fetch the gzipped x2t WASM, decompress it in the browser, and stash the
    // raw bytes on `window.Module.wasmBinary` BEFORE x2t.js runs. Emscripten
    // checks `Module['wasmBinary']` first and then skips its own fetch of the
    // raw `x2t.wasm` entirely, so only the ~10 MB .gz needs to be deployed
    // (the raw 40 MB file exceeds Cloudflare Pages' 25 MiB per-file limit).
    //
    // Servers disagree on how they serve a `.gz` file: some send it with
    // `Content-Encoding: gzip` (the browser has already decompressed the body
    // by the time we read it), others serve the raw gzip bytes. Detect which
    // by the leading magic bytes and only decompress a real gzip payload
    // (`1f 8b`), passing through an already-raw wasm module (`00 61 73 6d`).
    //
    // Transient failures are asked again before anyone above hears about them:
    // this is a 9.4 MB asset off a CDN, and one bad answer to it currently
    // costs the whole open. Cloudflare Pages served a 500 for exactly this
    // file mid-run on 2026-08-20 (PR #159) and the editor reported the
    // document as unopenable; the recovery that exists above -- rebuilding the
    // entire editor frame, re-fetching everything -- is far more expensive
    // than asking twice more, and it happened to land in the same bad window.
    // Retried only when the server says it failed (5xx / 408 / 429) or the
    // fetch itself rejected: a 404 or a 403 is a deployment fact, and retrying
    // only delays the error the user has to see. Nothing is retained between
    // attempts, so this does not add to the peak the streaming path exists to
    // keep down.
    X2TConverter.prototype.fetchWasmResponse = function () {
        var gzPath = this.WASM_GZ_PATH;
        var attempts = this.WASM_FETCH_ATTEMPTS;
        var backoffMs = this.WASM_FETCH_BACKOFF_MS;

        var wait = function (ms) {
            return new Promise(function (resolve) {
                setTimeout(resolve, ms);
            });
        };

        var attempt = function (n) {
            var again = function (error) {
                if (n >= attempts) throw error;
                console.warn('[x2t] retrying the WASM fetch after', error && error.message ? error.message : error);
                return wait(backoffMs * n).then(function () {
                    return attempt(n + 1);
                });
            };
            return fetch(gzPath).then(
                function (response) {
                    if (response.ok) return response;
                    var failure = new Error(
                        "Failed to fetch x2t WASM at '" + gzPath + "' (" + response.status + ')',
                    );
                    if (isTransientStatus(response.status)) return again(failure);
                    throw failure;
                },
                // A rejected fetch is a network fault (dropped connection,
                // DNS, an offline moment), which is the other half of what a
                // second ask fixes.
                function (error) {
                    return again(error);
                },
            );
        };

        return attempt(1);
    };

    // Whether the module can be compiled straight off the network, without the
    // decompressed 40.2 MB ever existing as one buffer. Checked up front so a
    // failure of the streaming path itself is never retried -- see
    // installStreamingInstantiate.
    X2TConverter.prototype.canStreamWasm = function () {
        return (
            typeof DecompressionStream === 'function' &&
            typeof ReadableStream === 'function' &&
            typeof WebAssembly !== 'undefined' &&
            typeof WebAssembly.instantiateStreaming === 'function'
        );
    };

    /**
     * Re-emit a body stream, having read just enough of it to tell gzip
     * (`1f 8b`) from a raw wasm module (`00 61 73 6d`) -- servers disagree on
     * how they serve a `.gz` file, and the sniff has to cost two bytes rather
     * than the whole download.
     */
    function sniffAndRebuild(body) {
        var reader = body.getReader();
        var prefix = [];
        var have = 0;
        var finished = false;

        var readPrefix = function () {
            if (have >= 2 || finished) return Promise.resolve();
            return reader.read().then(function (result) {
                if (result.done) {
                    finished = true;
                    return;
                }
                prefix.push(result.value);
                have += result.value.length;
                return readPrefix();
            });
        };

        return readPrefix().then(function () {
            // Concatenate rather than index into the chunks: a reader may split
            // the first two bytes across chunks, or hand back an empty one.
            var head = new Uint8Array(have);
            var at = 0;
            for (var h = 0; h < prefix.length; h++) {
                head.set(prefix[h], at);
                at += prefix[h].length;
            }
            var isGzip = head.length > 1 && head[0] === 0x1f && head[1] === 0x8b;
            var rebuilt = new ReadableStream({
                start: function (controller) {
                    for (var i = 0; i < prefix.length; i++) controller.enqueue(prefix[i]);
                    if (finished) controller.close();
                },
                pull: function (controller) {
                    if (finished) {
                        controller.close();
                        return;
                    }
                    return reader.read().then(function (result) {
                        if (result.done) {
                            finished = true;
                            controller.close();
                        } else {
                            controller.enqueue(result.value);
                        }
                    });
                },
                cancel: function (reason) {
                    return reader.cancel(reason);
                },
            });
            return isGzip ? rebuilt.pipeThrough(new DecompressionStream('gzip')) : rebuilt;
        });
    }

    /**
     * Compile and instantiate the module as it arrives.
     *
     * The buffered path below has to hold the inflated 40.2 MB while
     * WebAssembly.instantiate asks the browser for x2t's 283 MB heap and
     * compiles 40 MB of code -- all at the same moment, which is exactly the
     * moment that fails on a browser short of memory (GitHub #144). Streaming
     * removes that 40.2 MB from the peak entirely and lets compilation start
     * on the first chunk.
     *
     * `Module.instantiateWasm` is emscripten's own hook (x2t.js line ~627):
     * return `{}` to say "asynchronous", then call the success callback. It
     * MUST NOT throw synchronously -- createWasm() turns that into `false`,
     * which is fatal.
     */
    X2TConverter.prototype.installStreamingInstantiate = function () {
        var self = this;
        if (window.Module && window.Module.instantiateWasm) return;
        var instantiateWasm = function (imports, successCallback) {
            self.fetchWasmResponse()
                .then(function (response) {
                    if (!response.body) throw new Error('x2t WASM response has no body to stream');
                    return sniffAndRebuild(response.body);
                })
                .then(function (stream) {
                    // Our own Content-Type: the server's type for a .gz file is
                    // whatever it happens to be, and instantiateStreaming
                    // rejects anything that is not application/wasm.
                    return WebAssembly.instantiateStreaming(
                        new Response(stream, { headers: { 'Content-Type': 'application/wasm' } }),
                        imports,
                    );
                })
                .then(function (result) {
                    successCallback(result.instance, result.module);
                })
                .catch(function (error) {
                    // Deliberately not retried through the buffered path: the
                    // failure we most expect here is the browser refusing x2t's
                    // heap, and a retry would ask for another 40 MB on top of an
                    // already exhausted renderer. Surfacing it is what the open
                    // failure guard (lib/onlyoffice/open-failure.ts) needs --
                    // it classifies an allocation refusal as an environment
                    // failure and retries the whole editor instead.
                    //
                    // Rethrown with the `X2T module` prefix the guard's entry
                    // condition recognises, and the original wording kept after
                    // it so classifyOpenFailure still reads the cause. Without
                    // the prefix only the allocation refusals reach the guard:
                    // everything else (a 404 on x2t.wasm.gz, a dropped
                    // connection mid-stream) leaves successCallback uncalled
                    // and the user watching the spinner until doInitialize's
                    // INIT_TIMEOUT fires a minute later. On the buffered path
                    // the same failure rejected loadScript() straight away.
                    console.error('x2t WASM instantiation failed:', error);
                    var failure = new Error(
                        'X2T module failed to instantiate: ' + ((error && error.message) || String(error)),
                    );
                    // Tell the pending initialize() before the rethrow: without
                    // this nothing here ever settles it, and the module's own
                    // onRuntimeInitialized is never going to fire, so the caller
                    // waits out the full INIT_TIMEOUT for a failure that is
                    // already known.
                    self.wasmInstantiateError = failure;
                    if (self.onWasmInstantiateError) self.onWasmInstantiateError(failure);
                    // Still rethrown: the unhandled rejection is what
                    // installOpenFailureGuard reads to classify and retry.
                    throw failure;
                });
            return {};
        };
        window.Module = Object.assign({}, window.Module, { instantiateWasm: instantiateWasm });
    };

    // Fallback for engines without streaming instantiation: fetch the gzip,
    // inflate it whole, and hand emscripten the bytes. Emscripten checks
    // `Module['wasmBinary']` first and then skips its own fetch of the raw
    // `x2t.wasm` entirely, so only the ~10 MB .gz needs to be deployed (the
    // raw 40 MB file exceeds Cloudflare Pages' 25 MiB per-file limit).
    X2TConverter.prototype.prepareWasmBinary = function () {
        if (window.Module && window.Module.wasmBinary) return Promise.resolve();

        return this.fetchWasmResponse().then(function (response) {
            return response.arrayBuffer();
        }).then(function (raw) {
            var head = new Uint8Array(raw, 0, Math.min(2, raw.byteLength));
            var isGzip = head[0] === 0x1f && head[1] === 0x8b;
            if (!isGzip) return raw;
            var stream = new Response(raw).body.pipeThrough(new DecompressionStream('gzip'));
            return new Response(stream).arrayBuffer();
        }).then(function (wasmBinary) {
            // Pre-seed the global Module so x2t.js (which reuses an existing
            // global Module) picks up the binary; preserve existing props.
            window.Module = Object.assign({}, window.Module, { wasmBinary: wasmBinary });
        });
    };

    X2TConverter.prototype.loadScript = function () {
        // A promise, not `undefined`: doInitialize does `loadScript().then(...)`,
        // and the streaming path reaches this branch routinely -- the <script>
        // loads fine, so hasScriptLoaded is set, and only the wasm behind it
        // fails. A bare `return` then threw `undefined.then is not a function`
        // out of every subsequent attempt.
        if (this.hasScriptLoaded) return Promise.resolve()

        // Streaming keeps the inflated module out of the peak; the buffered
        // path stays for engines that cannot stream.
        var prepared;
        if (this.canStreamWasm()) {
            this.installStreamingInstantiate();
            prepared = Promise.resolve();
        } else {
            prepared = this.prepareWasmBinary();
        }
        return prepared.then(() => new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = this.SCRIPT_PATH
            script.onload = () => {
                this.hasScriptLoaded = true
                console.log('X2T WASM script loaded successfully')
                resolve()
            }

            script.onerror = (error) => {
                const errorMsg = 'Failed to load X2T WASM script'
                console.error(errorMsg, error)
                reject(new Error(errorMsg))
            }

            document.head.appendChild(script)
        }))
    };

    X2TConverter.prototype.doInitialize = function () {
        var self = this;

        return this.loadScript().then(function () {
            return new Promise(function (resolve, reject) {
                var x2t = window.Module;
                if (!x2t) {
                    reject(new Error('X2T module not found after script loading'));
                    return;
                }

                // The hook may have already failed while the script was
                // loading, or may fail while this promise is pending.
                if (self.wasmInstantiateError) {
                    reject(self.wasmInstantiateError);
                    return;
                }

                var timeoutId = setTimeout(function () {
                    if (!self.isReady) {
                        reject(new Error('X2T initialization timeout after ' + self.INIT_TIMEOUT + 'ms'));
                    }
                }, self.INIT_TIMEOUT);

                self.onWasmInstantiateError = function (error) {
                    clearTimeout(timeoutId);
                    reject(error);
                };

                x2t.onRuntimeInitialized = function () {
                    try {
                        clearTimeout(timeoutId);
                        self.onWasmInstantiateError = null;
                        self.createWorkingDirectories(x2t);
                        self.x2tModule = x2t;
                        self.isReady = true;
                        console.log('X2T module initialized successfully');
                        resolve(x2t);
                    } catch (error) {
                        reject(error);
                    }
                };
            });
        }).catch(function (error) {
            self.initPromise = null;
            self.onWasmInstantiateError = null;
            throw error;
        });
    };

    X2TConverter.prototype.createWorkingDirectories = function (x2t) {
        this.WORKING_DIRS.forEach(function (dir) {
            try {
                x2t.FS.mkdir(dir);
            } catch (error) {
                console.warn('Directory ' + dir + ' may already exist:', error);
            }
        });
    };


    X2TConverter.prototype.cleanWorkingDirectory = function () {
        if (!this.x2tModule) return;

        var self = this;
        try {
            var files = this.x2tModule.FS.readdir('/working/');
            files.forEach(function (file) {
                if (file !== '.' && file !== '..' && file !== 'media' && file !== 'fonts' && file !== 'themes') {
                    try {
                        self.x2tModule.FS.unlink('/working/' + file);
                    } catch (e) {
                        // Ignore deletion errors
                    }
                }
            });

            var mediaFiles = this.x2tModule.FS.readdir('/working/media/');
            mediaFiles.forEach(function (file) {
                if (file !== '.' && file !== '..') {
                    try {
                        self.x2tModule.FS.unlink('/working/media/' + file);
                    } catch (e) {
                    }
                }
            });
        } catch (error) {
            console.warn('Failed to clean working directory:', error.message);
        }
    };

    X2TConverter.prototype.getDocumentType = function (extension) {
        if (extension.indexOf('.') !== -1) {
            extension = extension.replace('.', '');
        }
        var docType = this.DOCUMENT_TYPE_MAP[extension.toLowerCase()];
        if (!docType) {
            throw new Error('Unsupported file format: ' + extension);
        }
        return docType;
    };

    X2TConverter.prototype.sanitizeFileName = function (fileName) {
        if (!fileName) {
            throw new Error('File name cannot be empty');
        }
        if (fileName.indexOf('.') !== -1) {
            fileName = fileName.substring(0, fileName.indexOf('.'));
        }
        var illegalChars = /[\/\?<>\\:\*\|"]/g;
        var controlChars = /[\x00-\x1f\x80-\x9f]/g;
        var reservedPattern = /^\.+$/;
        var unsafeChars = /[&'%!"{}[\]]/g;
        var sanitized = fileName
            .replace(illegalChars, '')
            .replace(controlChars, '')
            .replace(reservedPattern, '')
            .replace(unsafeChars, '');

        sanitized = sanitized.trim();
        return sanitized;
    };

    X2TConverter.prototype.executeConversion = function (paramsPath) {
        if (!this.x2tModule) {
            throw new Error('X2T module not initialized');
        }

        var result = this.x2tModule.ccall('main1', 'number', ['string'], [paramsPath]);
        if (result !== 0) {
            throw new Error('Conversion failed with code: ' + result);
        }
    };

    X2TConverter.prototype.createConversionParams = function (fromPath, toPath, additionalParams) {
        additionalParams = additionalParams || '';
        return '<?xml version="1.0" encoding="utf-8"?>\n' +
            '<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n' +
            '  <m_sFileFrom>' + fromPath + '</m_sFileFrom>\n' +
            '  <m_sThemeDir>/working/themes</m_sThemeDir>\n' +
            '  <m_sFileTo>' + toPath + '</m_sFileTo>\n' +
            '  <m_bIsNoBase64>true</m_bIsNoBase64>\n' +
            '  ' + additionalParams + '\n' +
            '</TaskQueueDataConvert>';
    };

    X2TConverter.prototype.escapeXml = function (unsafe) {
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<':
                    return '&lt;';
                case '>':
                    return '&gt;';
                case '&':
                    return '&amp;';
                case '\'':
                    return '&apos;';
                case '"':
                    return '&quot;';
                default:
                    return c;
            }
        });
    };

    X2TConverter.prototype.writeMediaFiles = function (files) {
        let that = this;
        let promises = [];

        Object.keys(files || {}).forEach(function (mediaFileName) {
            if (/\.bin$/.test(mediaFileName)) {
                return;
            }

            let url = files[mediaFileName];
            mediaFileName = mediaFileName.substring(6);
            if (url) {
                let promise = handleFileData(url).then(binary => {
                    if (binary) {
                        that.x2tModule.FS.writeFile('/working/media/' + mediaFileName, binary);
                    }
                }).catch(error => {
                    console.warn('Failed to write media file ' + mediaFileName + ':', error);
                });
                promises.push(promise);
            }
        });

        return Promise.all(promises);
    };

    // 无扩展名/未知扩展名时按文件头嗅探图片类型
    // （Word 公式、数学符号等媒体文件解包后可能不带后缀，扩展名不可用）
    function sniffImageMime(bytes) {
        if (!bytes || bytes.length < 4) return null;
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
        if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
        if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
        if (bytes[0] === 0x42 && bytes[1] === 0x4D) return 'image/bmp';
        if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
            bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
        // WMF（placeable header）
        if (bytes[0] === 0xD7 && bytes[1] === 0xCD && bytes[2] === 0xC6 && bytes[3] === 0x9A) return 'image/x-wmf';
        // EMF：头 4 字节 01 00 00 00，偏移 40 处为 " EMF"
        if (bytes.length > 44 && bytes[0] === 0x01 && bytes[1] === 0x00 && bytes[2] === 0x00 && bytes[3] === 0x00 &&
            bytes[40] === 0x20 && bytes[41] === 0x45 && bytes[42] === 0x4D && bytes[43] === 0x46) return 'image/x-emf';
        // SVG：文本格式，前 1KB 内出现 <svg 标签（兼容带 XML 声明/BOM/注释的情况）
        var head = '';
        for (var i = 0; i < Math.min(bytes.length, 1024); i++) {
            head += String.fromCharCode(bytes[i]);
        }
        if (/<svg[\s>]/i.test(head)) return 'image/svg+xml';
        return null;
    }

    X2TConverter.prototype.readMediaFiles = function () {
        if (!this.x2tModule) return {};

        var media = {};
        var self = this;

        try {
            var files = this.x2tModule.FS.readdir('/working/media/');
            files
                .filter(function (file) {
                    return file !== '.' && file !== '..';
                })
                .forEach(function (file) {
                    try {
                        var fileData = self.x2tModule.FS.readFile('/working/media/' + file, {
                            encoding: 'binary'
                        });
                        // 按扩展名设置 MIME type：SVG 在 <img> 中必须是 image/svg+xml 才能渲染，
                        // 不指定 type 的 blob 会被当作 text/plain 导致矢量图不显示；
                        // 无扩展名或未知扩展名（如 Word 数学符号）时回落到文件头嗅探
                        var ext = (file.indexOf('.') !== -1 ? file.split('.').pop() : '').toLowerCase();
                        var mime = ext ? self.getMimeTypeFromExtension(ext) : 'application/octet-stream';
                        if (mime === 'application/octet-stream') {
                            mime = sniffImageMime(fileData) || 'application/octet-stream';
                        }
                        var blob = new Blob([fileData], {type: mime});
                        var mediaUrl = URL.createObjectURL(blob);
                        media['media/' + file] = mediaUrl;
                    } catch (error) {
                        console.warn('Failed to read media file ' + file + ':', error);
                    }
                });
        } catch (error) {
            console.warn('Failed to read media directory:', error);
        }

        return media;
    };
    X2TConverter.prototype.downloadFile = function (data, fileName) {
        // ── 对外提供文件流：把导出的文件字节 postMessage 给宿主窗口（父窗口/顶层），
        //    供宿主保存/上传。宿主设置 window.OO_FILE_STREAM_ONLY=true 时只给流、不触发浏览器下载。──
        try {
            var buffer;
            if (data instanceof ArrayBuffer) {
                buffer = data.slice(0);
            } else if (data && data.buffer instanceof ArrayBuffer) {
                buffer = data.buffer.slice(data.byteOffset || 0, (data.byteOffset || 0) + data.byteLength);
            } else if (data) {
                buffer = new Uint8Array(data).buffer;
            }
            if (buffer) {
                var ext = (String(fileName || '').split('.').pop() || '').toLowerCase();
                var payload = { type: 'onlyoffice-file-stream', fileName: fileName, fileType: ext, buffer: buffer };
                var targets = [];
                if (window.parent && window.parent !== window) targets.push(window.parent);
                if (window.top && window.top !== window && window.top !== window.parent) targets.push(window.top);
                targets.forEach(function (t) {
                    try { t.postMessage(payload, '*'); } catch (e) {}
                });
            }
        } catch (e) {}

        // 宿主声明只要文件流时跳过浏览器下载（沿父窗口链查找标志，兼容多层 iframe 嵌套）
        var __ooStreamOnly = false;
        try {
            for (var __w = window, __d = 0; __w && __d < 6; __d++) {
                if (__w.OO_FILE_STREAM_ONLY === true) { __ooStreamOnly = true; break; }
                if (__w.parent === __w) break;
                __w = __w.parent;
            }
        } catch (e) {}
        if (__ooStreamOnly) {
            return;
        }

        var blob = new Blob([data]);
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        setTimeout(function () {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    };

    X2TConverter.prototype.getMimeTypeFromExtension = function (extension) {
        var mimeMap = {
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            doc: 'application/msword',
            odt: 'application/vnd.oasis.opendocument.text',
            rtf: 'application/rtf',
            txt: 'text/plain',
            pdf: 'application/pdf',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            xls: 'application/vnd.ms-excel',
            ods: 'application/vnd.oasis.opendocument.spreadsheet',
            csv: 'text/csv',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            ppt: 'application/vnd.ms-powerpoint',
            odp: 'application/vnd.oasis.opendocument.presentation',
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            bmp: 'image/bmp',
            webp: 'image/webp',
            svg: 'image/svg+xml'
        };

        return mimeMap[extension.toLowerCase()] || 'application/octet-stream';
    };

    X2TConverter.prototype.getFileDescription = function (extension) {
        var descriptionMap = {
            docx: 'Word Document',
            doc: 'Word 97-2003 Document',
            odt: 'OpenDocument Text',
            pdf: 'PDF Document',
            xlsx: 'Excel Workbook',
            xls: 'Excel 97-2003 Workbook',
            ods: 'OpenDocument Spreadsheet',
            pptx: 'PowerPoint Presentation',
            ppt: 'PowerPoint 97-2003 Presentation',
            odp: 'OpenDocument Presentation',
            txt: 'Text Document',
            rtf: 'Rich Text Format',
            csv: 'CSV File'
        };

        return descriptionMap[extension.toLowerCase()] || 'Document';
    };

    X2TConverter.prototype.destroy = function () {
        this.x2tModule = null;
        this.initPromise = null;
        console.log('X2T converter destroyed');
    };

    X2TConverter.prototype.convertDocument = function (binary, fileName, fileExt) {
        if (fileExt.indexOf('.') !== -1) {
            fileExt = fileExt.replace('.', '');
        }
        const convertMap = {
            'doc': 'docx',
            'xls': 'xlsx',
            'ppt': 'pptx',
        }
        const targetExt = convertMap[fileExt];
        if (targetExt) {
            return this._convertDocument({
                'binary': binary,
                'fileName': fileName,
                'fileExt': fileExt,
                'targetExt': targetExt,
            });
        }
        return null;
    };

    X2TConverter.prototype.fetchFonts = async function () {
        let that = this;
        return new Promise(function (resolve, reject) {
            window["AscCommon"]['fetchFonts'](function (data) {
                try {
                    if (data && data.length > 0) {
                        data.forEach(function (obj) {
                            that.x2tModule.FS.writeFile('/working/fonts/' + obj['fileName'], obj['binary']);
                        })
                    }
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    };

    X2TConverter.prototype.convertFromBin = async function (obj) {
        let {fileExt, targetExt} = obj;
        fileExt = fileExt || 'bin';
        if (fileExt.indexOf('.') === -1) {
            fileExt = '.' + fileExt;
        }
        targetExt = '.' + targetExt.substring(targetExt.lastIndexOf('.') + 1);
        if (fileExt === '.pdf' && obj.pdfChanges) {
            var mergedPdf = await this._convertPdfFromChanges(obj);
            if (targetExt === '.pdf') {
                return mergedPdf;
            }
            return this._convertDocument({
                ...obj,
                'binary': mergedPdf.binary,
                'fileExt': 'pdf',
                'targetExt': targetExt,
                'pdfChanges': null
            });
        }
        if (fileExt === targetExt) {
            var binary = await handleFileData(obj.binary);
            var extension = fileExt.substring(1).toLowerCase();
            return {
                fileName: this.sanitizeFileName(obj.fileName),
                fileExt: fileExt,
                type: this.DOCUMENT_TYPE_MAP[extension] || extension,
                media: {},
                binary: binary,
                size: binary.length
            };
        }
        if (fileExt === '.pdf') {
            return this._convertDocument({...obj, 'fileExt': 'pdf', 'targetExt': targetExt});
        }
        // 打印/导出 PDF 时编辑器传入的是渲染指令流，没有 DOCY/XLSY/PPTY 签名，
        // x2t 无法自动识别，必须显式声明输入格式为 canvas-pdf
        let formatFrom = null;
        let bin = obj.binary;
        if (bin instanceof ArrayBuffer) {
            bin = new Uint8Array(bin);
        }
        if (isTypedArray(bin) && bin.length >= 4) {
            let sig = String.fromCharCode(bin[0], bin[1], bin[2], bin[3]);
            if (sig !== 'DOCY' && sig !== 'XLSY' && sig !== 'PPTY' && sig !== 'VSDY') {
                formatFrom = CANVAS_PDF_INPUT_FORMAT;
            }
        }
        return this._convertDocument({...obj, 'fileExt': 'bin', 'targetExt': targetExt, 'formatFrom': formatFrom});
    };

    X2TConverter.prototype._ensureDirectory = function (directoryPath) {
        if (!this.x2tModule.FS.analyzePath(directoryPath).exists) {
            this.x2tModule.FS.mkdir(directoryPath);
        }
    };

    X2TConverter.prototype._clearDirectory = function (directoryPath) {
        var fileSystem = this.x2tModule.FS;
        fileSystem.readdir(directoryPath).forEach(function (fileName) {
            if (fileName !== '.' && fileName !== '..') {
                fileSystem.unlink(directoryPath + '/' + fileName);
            }
        });
    };

    X2TConverter.prototype._writePdfChangesInput = async function (obj) {
        var original = await handleFileData(obj.binary);
        var changes = await handleFileData(obj.pdfChanges);
        this._ensureDirectory(PDF_CHANGES_DIR);
        this._clearDirectory(PDF_CHANGES_DIR);
        this.x2tModule.FS.writeFile(PDF_ORIGIN_PATH, original);
        this.x2tModule.FS.writeFile(PDF_CHANGES_PATH, changes);
    };

    X2TConverter.prototype._createPdfChangesParams = function () {
        return '<m_sFontDir>/working/fonts/</m_sFontDir>\n' +
            '<m_nFormatTo>' + PDF_OUTPUT_FORMAT + '</m_nFormatTo>\n' +
            '<m_bFromChanges>true</m_bFromChanges>\n';
    };

    X2TConverter.prototype._convertPdfFromChanges = async function (obj) {
        try {
            await this.initialize();
            await this.writeMediaFiles(obj.medias);
            await this.fetchFonts();
            await this._writePdfChangesInput(obj);
            var params = this.createConversionParams(
                PDF_ORIGIN_PATH,
                PDF_OUTPUT_PATH,
                this._createPdfChangesParams()
            );
            this.x2tModule.FS.writeFile(PDF_PARAMS_PATH, params);
            this.executeConversion(PDF_PARAMS_PATH);
            var result = this.x2tModule.FS.readFile(PDF_OUTPUT_PATH);
            return {
                fileName: this.sanitizeFileName(obj.fileName),
                fileExt: '.pdf',
                type: 'pdf',
                media: this.readMediaFiles(),
                binary: result,
                size: result.length
            };
        } catch (error) {
            throw new Error('Document conversion failed: ' + error);
        }
    };


    X2TConverter.prototype.convertToBin = async function (data, fileName, fileExt) {
        let self = this;
        fileExt = fileExt || '.DOCX';
        if (fileExt.indexOf('.') === -1) {
            fileExt = '.' + fileExt;
        }
        if (fileExt === '.pdf') {
            let binary = await handleFileData(data);
            return new Promise(function (resolve, reject) {
                resolve({
                    fileName: self.sanitizeFileName(fileName),
                    fileExt: fileExt,
                    type: 'pdf',
                    media: {},
                    binary: binary,
                    size: binary.length
                })
            })
        }
        let result = await this.convertDocument(data, fileName, fileExt);
        if (result) {
            data = result.binary;
            fileName = result.fileName;
            fileExt = result.fileExt;
        }
        return this._convertDocument({'binary': data, 'fileName': fileName, 'fileExt': fileExt, 'targetExt': 'bin'});
    };

    X2TConverter.prototype._convertDocument = function (obj) {
        let {binary, fileName, fileExt, targetExt, medias, formatFrom} = obj;
        var self = this;
        if (targetExt.indexOf('.') === -1) {
            targetExt = '.' + targetExt;
        }
        if (fileExt.indexOf('.') === -1) {
            fileExt = '.' + fileExt;
        }

        return this.initialize().then(function () {
            return handleFileData(binary);
        }).then(function (uint8Array) {
            return new Promise(async function (resolve, reject) {
                try {
                    await self.writeMediaFiles(medias);
                    await self.fetchFonts();
                    var sanitizedName = self.sanitizeFileName(fileName);
                    var workspace = `/working/`;
                    var inputPath = workspace + sanitizedName + fileExt;
                    var outputPath = workspace + sanitizedName + targetExt;

                    self.x2tModule.FS.writeFile(inputPath, uint8Array);
                    var pdfData = '';
                    if (targetExt.toLowerCase() === '.pdf') {
                        pdfData = "<m_sFontDir>/working/fonts/</m_sFontDir>\n" +
                            '<m_nFormatTo>' + PDF_OUTPUT_FORMAT + '</m_nFormatTo>\n' +
                            '<m_bIsPDFA>true</m_bIsPDFA>\n';
                        // Add conversion rules for PDF with enhanced configuration
                    }
                    if (formatFrom) {
                        pdfData += '<m_nFormatFrom>' + formatFrom + '</m_nFormatFrom>\n';
                    }
                    var params = self.createConversionParams(inputPath, outputPath, pdfData);
                    self.x2tModule.FS.writeFile(workspace + 'params.xml', params);

                    self.executeConversion(workspace + 'params.xml');

                    var result = self.x2tModule.FS.readFile(outputPath);
                    var media = self.readMediaFiles();

                    var documentType = self.getDocumentType(fileExt === '.bin' ? targetExt.toLowerCase() : fileExt.toLowerCase());
                    resolve({
                        fileName: sanitizedName,
                        fileExt: targetExt,
                        type: documentType,
                        media: media,
                        binary: result,
                        size: result.length
                    });
                } catch (error) {
                    reject(new Error('Document conversion failed: ' + error));
                }
            });
        });
    };


    //----------------------------------------------------------export----------------------------------------------------
    AscCommon['x2t'] = new X2TConverter()
    X2TConverter.prototype['convertToBin'] = X2TConverter.prototype.convertToBin;
    X2TConverter.prototype['convertFromBin'] = X2TConverter.prototype.convertFromBin;
    X2TConverter.prototype['convertDocument'] = X2TConverter.prototype.convertDocument;
    X2TConverter.prototype['downloadFile'] = X2TConverter.prototype.downloadFile;
    X2TConverter.prototype['destroy'] = X2TConverter.prototype.destroy;
})()
