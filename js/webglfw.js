/*
* A micro Webgl framework for my demos
* Author: M. Utku Altinkaya: utkualtinkaya@gmail.com
* Code is in public domain
*/

var gl;
var canvas;
function WebGLFw(canvas) {

    var gl;

    var names = ['webgl', 'moz-webgl', 'experimental-webgl'];
    for (var i=0; i<names.length; i++)
        try {
            gl = canvas.getContext(names[i]);
            if (gl) break;
        } catch (e) {};

    console.log(gl);

    function Shader(vs, fs) {
        var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fs);
        gl.compileShader(fragmentShader);
        var vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vs);
        gl.compileShader(vertexShader);
        var shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);
        gl.useProgram(shaderProgram);

        var num = gl.getProgramParameter(shaderProgram, gl.ACTIVE_ATTRIBUTES);
        for (var i = 0; i < num; ++i) {
            var info = gl.getActiveAttrib(shaderProgram, i);
            this[info.name] = gl.getAttribLocation(shaderProgram, info.name);
        }
        var num = gl.getProgramParameter(shaderProgram, gl.ACTIVE_UNIFORMS);
        for (var i = 0; i < num; ++i) {
            var info = gl.getActiveUniform(shaderProgram, i);
            this[info.name] = gl.getUniformLocation(shaderProgram, info.name);
        }

        this.samplers = 0;
        this.program = shaderProgram;
    }

    var defaultShader = new Shader(
        "uniform highp vec4 diffuseColor;" +
        "attribute highp vec3 position;" +
        "uniform highp mat4 projection, view, world;" +
        "void main(void) {" +
        "gl_Position = projection * view * world * vec4(position, 1.0);" +
        "}",
         "void main(void) {" +
         "  gl_FragColor = vec4(0,0,0,1);" +
         "}"
     )

    function Camera() {
        this.rotX = 0.7;
        this.rotY = 2.3;
        this.distance = 3;
        this.lookAt = vec3.fromValues(0, 0, 0);
        var projection = this.projection = mat4.perspective(mat4.create(), 45, $(canvas).width() / $(canvas).height(), 0.1, 100);
        var view = this.view = mat4.create();
        this.update = function () {
            mat4.translate(view, mat4.create(), vec3.fromValues(0.0, 0.0, -this.distance));
            mat4.rotateX(view, view,this.rotX);
            mat4.rotateY(view, view, this.rotY);
            mat4.translate(view, view, this.lookAt);
        }
        this.assign = function (shader) {
            gl.uniformMatrix4fv(shader.projection, false, projection);
            gl.uniformMatrix4fv(shader.view, false, view);
        }
        this.update();
    }

    function Buffer(name, type, data, size) {
        var buffer = gl.createBuffer();
        size = size || 3;
        gl.bindBuffer(type, buffer);
        gl.bufferData(type, data, gl.STATIC_DRAW);
        this.bind = function (shader) {
            gl.bindBuffer(type, buffer);
            if (type == gl.ARRAY_BUFFER && name in shader) {
                gl.vertexAttribPointer(shader[name], size, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(shader[name]);
            }
        }
        this.unbind = function (shader) {
            if (type == gl.ARRAY_BUFFER) {
                gl.disableVertexAttribArray(shader[name]);
            }
        }
    }

    function parse(data, handler) {
        var ret = {};
        $(data.split("\n")).each(function (i, v) {
            var row = v.split(" ");
            var cmd = row[0];
            if (!(cmd in ret)) ret[cmd] = [];
            $(row.slice(1)).each(function (i, v) {
                ret[cmd].push(cmd in handler ? handler[cmd](v, ret) : parseFloat(v));
            });
        });
        return ret;
    }

    function Texture(name, url) {
        var image = new Image();
        var loaded = false;
        var texture = null;
        image.onload = function () {
          console.log("loaded texture:" + url);
          texture = gl.createTexture();
          console.log(texture);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.bindTexture(gl.TEXTURE_2D, null);
        }
        image.src = url;
        this.bind = function(shader) {
            this.unit = shader.samplers++;
            gl.activeTexture(gl.TEXTURE0+this.unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(shader[name], this.unit);

        }
        this.unbind = function(shader) {
            shader.samplers--;
            gl.activeTexture(gl.TEXTURE0+this.unit);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
    }

    function Material() {
        var maps = [];
        this.diffuseColor = vec4.fromValues(1, 0, 0, 1);
        this.maps = maps;
        this.load = function (url) {
            $.get(url, function (data) {
                parse(data, {
                    map_Kd: function (v) {
                        maps.push(new Texture("diffuseTexture", url.replace(/[^/]+$/, v)))
                    }
                });
            });
        };
        this.bind = function (shader) {
            gl.uniform4fv(shader["diffuseColor"], this.diffuseColor);
            $(maps).each(function (i, v) {
                v.bind(shader);
            });
        }
        this.unbind = function (shader) {
            $(maps).each(function (i, v) {
                v.unbind(shader);
            });
        }
    }

    function Model(url) {
        this.verts = [];
        this.norms = [];
        this.uvs = [];
        this.indices = [];
        this.loaded = false;
        this.element = gl.TRIANGLES;
        this.buffers = [];
        this.material = new Material();
        var model = this;
        if (url) {
            //this.material.load(url.replace(/[^.]+$/, "mtl"));
            $.get(url, function (d) {
                parse(d, {
                    f: function (v, data) {
                        var idx = v.split("/");
                        idx[0]--; idx[1]--; idx[2]--;// obj indices are 1 based
                        model.verts.push(data["v"][idx[0]*3], data["v"][idx[0]*3+1], data["v"][idx[0]*3+2]);
                        model.norms.push(data["vn"][idx[2]*3], data["vn"][idx[2]*3+1], data["vn"][idx[2]*3+2]);
                        if (idx[1] > -1)
                            model.uvs.push(data["vt"][idx[1]*2], data["vt"][idx[1]*2+1]);
                        model.indices.push(model.verts.length/3-1);
                    }
                });
            });
        };

        this.load = function () {
            this.buffers = [];
            this.buffers.push(new Buffer("", gl.ELEMENT_ARRAY_BUFFER, new Int16Array(this.indices)));
            this.buffers.push(new Buffer("position", gl.ARRAY_BUFFER, new Float32Array(this.verts)));
            if (this.uvs.length)
                this.buffers.push(new Buffer("uv", gl.ARRAY_BUFFER, new Float32Array(this.uvs), 2));
            if (this.norms.length)
                this.buffers.push(new Buffer("normal", gl.ARRAY_BUFFER, new Float32Array(this.norms)));
            this.loaded = true;
        }

        this.render = function (shader) {
            if (!this.indices.length) return;
            if (!this.loaded) {
                this.load();
            }
            for (var i=0; i<this.buffers.length; i++) {
                this.buffers[i].bind(shader);
            }
            this.material.bind(shader);
            gl.drawElements(this.element, this.indices.length, gl.UNSIGNED_SHORT, 0);
            for (var i=0; i<this.buffers.length; i++) {
                this.buffers[i].unbind(shader);
            }
            this.material.unbind(shader);
        }
    }

    var Grid = function () {
        this.element = gl.LINES;
        var addLine = function (x,y,x1,y1) {
            this.verts.push(x,0,y,x1,0,y1);
            this.indices.push(this.verts.length/3-2, this.verts.length/3-1);
        }
        for (var i = -5; i<6; i++) {
            addLine.call(this, i,-5,i,5);
            addLine.call(this,-5,i,5,i);
        }
        this.load();
    };
    Grid.prototype = new Model();

    this.Shader = Shader;
    this.Camera = Camera;
    this.Buffer = Buffer;
    this.Material = Material;
    this.Texture = Texture;
    this.Model = Model;
    this.Grid = Grid;
    this.gl = gl;
    this.defaultShader = defaultShader;
}

window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                               window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
