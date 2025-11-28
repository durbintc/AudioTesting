"use strict";
import { initFileShaders, perspective, vec2, vec4, flatten, lookAt, rotateX, rotateY } from '../helperfunctions.js';
let gl;
let program;
let activeProgram;
let anisotropic_ext; //TODO next week...
let checkerTex;
//uniform locations
let umv; //uniform for mv matrix
let uproj; //uniform for projection matrix
//matrices
let mv; //local mv
let p; //local projection
//shader variable indices for material properties
let vPosition; //
let vTexCoord;
let uTextureSampler; //this will be a pointer to our sampler2D
//document elements
let canvas;
//interaction and rotation state
let xAngle;
let yAngle;
let mouse_button_down = false;
let prevMouseX = 0;
let prevMouseY = 0;
let zoom = 45;
let noiseWidth = 128;
let noiseHeight = 128;
let noise;
window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext('webgl2', { antialias: true });
    if (!gl) {
        alert("WebGL isn't available");
    }
    //allow the user to rotate mesh with the mouse
    canvas.addEventListener("mousedown", mouse_down);
    canvas.addEventListener("mousemove", mouse_drag);
    canvas.addEventListener("mouseup", mouse_up);
    //black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    program = initFileShaders(gl, "vshader-texture.glsl", "fshader-texture.glsl");
    gl.useProgram(program);
    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");
    uTextureSampler = gl.getUniformLocation(program, "textureSampler"); //get reference to sampler2D
    //set up basic perspective viewing
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    p = perspective(zoom, (canvas.clientWidth / canvas.clientHeight), 1, 20);
    gl.uniformMatrix4fv(uproj, false, p.flatten());
    generateNoise();
    initTexture(512, 512);
    makeSquareAndBuffer();
    //initialize rotation angles
    xAngle = 0;
    yAngle = 0;
    window.addEventListener("keydown", event => {
        switch (event.key) {
            case "ArrowDown":
                if (zoom < 170) {
                    zoom += 5;
                }
                break;
            case "ArrowUp":
                if (zoom > 10) {
                    zoom -= 5;
                }
                break;
            case "l":
                //TODO 2nd Coding activity:
                //TODO try altering minification and magnification filters here
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); //try different min and mag filters
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                break;
            case "n":
                //TODO try altering minification and magnification filters here
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); //try different min and mag filters
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                break;
            case "k":
                //TODO 2nd Coding activity:
                //TODO try altering minification and magnification filters here
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); //try different min and mag filters
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                break;
            case "m":
                //TODO try altering minification and magnification filters here
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); //try different min and mag filters
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                break;
        }
        p = perspective(zoom, (canvas.clientWidth / canvas.clientHeight), 1, 20);
        gl.uniformMatrix4fv(uproj, false, p.flatten());
        requestAnimationFrame(render); //and now we need a new frame since we made a change
    });
    window.setInterval(update, 16);
    requestAnimationFrame(render);
};
//Make a square and send it over to the graphics card
function makeSquareAndBuffer() {
    let squarePoints = []; //empty array
    let a = 1.5;
    let b = 2;
    //create 4 vertices and add them to the array
    squarePoints.push(new vec4(-1, -1, 0, 1));
    squarePoints.push(new vec2(0, 0)); //texture coordinates, bottom left
    squarePoints.push(new vec4(1, -1, 0, 1));
    squarePoints.push(new vec2(a, 0)); //texture coordinates, bottom right
    squarePoints.push(new vec4(1, 1, 0, 1));
    squarePoints.push(new vec2(a, b)); //texture coordinates, top right
    squarePoints.push(new vec4(-1, 1, 0, 1));
    squarePoints.push(new vec2(0, b)); //texture coordinates, top left
    //we need some graphics memory for this information
    let bufferId = gl.createBuffer();
    //tell WebGL that the buffer we just created is the one we want to work with right now
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    //send the local data over to this buffer on the graphics card.  Note our use of Angel's "flatten" function
    gl.bufferData(gl.ARRAY_BUFFER, flatten(squarePoints), gl.STATIC_DRAW);
    vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 24, 0); //stride is 24 bytes total for position, texcoord
    gl.enableVertexAttribArray(vPosition);
    vTexCoord = gl.getAttribLocation(program, "texCoord");
    gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 24, 16); //stride is 24 bytes total for position, texcoord
    gl.enableVertexAttribArray(vTexCoord);
}
//update rotation angles based on mouse movement
function mouse_drag(event) {
    let thetaY, thetaX;
    if (mouse_button_down) {
        thetaY = 360.0 * (event.clientX - prevMouseX) / canvas.clientWidth;
        thetaX = 360.0 * (event.clientY - prevMouseY) / canvas.clientHeight;
        prevMouseX = event.clientX;
        prevMouseY = event.clientY;
        xAngle += thetaX;
        yAngle += thetaY;
    }
    requestAnimationFrame(render);
}
//record that the mouse button is now down
function mouse_down(event) {
    //establish point of reference for dragging mouse in window
    mouse_button_down = true;
    prevMouseX = event.clientX;
    prevMouseY = event.clientY;
    requestAnimationFrame(render);
}
//record that the mouse button is now up, so don't respond to mouse movements
function mouse_up() {
    mouse_button_down = false;
    requestAnimationFrame(render);
}
//Note here we're populating memory with colors using a math function
//Next time we'll look at loading an image from a file
// Generate a random noise field
function generateNoise() {
    noise = []; // Initialize the array
    for (let y = 0; y < noiseHeight; y++) {
        noise[y] = []; // Initialize each row
        for (let x = 0; x < noiseWidth; x++) {
            noise[y][x] = Math.random();
        }
    }
}
// Smooth noise function
function smoothNoise(x, y) {
    let fractX = x - Math.floor(x);
    let fractY = y - Math.floor(y);
    let x1 = (Math.floor(x) + noiseWidth) % noiseWidth;
    let y1 = (Math.floor(y) + noiseHeight) % noiseHeight;
    let x2 = (x1 + noiseWidth - 1) % noiseWidth;
    let y2 = (y1 + noiseHeight - 1) % noiseHeight;
    let value = 0.0;
    value += fractX * fractY * noise[y1][x1];
    value += (1 - fractX) * fractY * noise[y1][x2];
    value += fractX * (1 - fractY) * noise[y2][x1];
    value += (1 - fractX) * (1 - fractY) * noise[y2][x2];
    return value;
}
// Turbulence function (fixed)
function turbulence(x, y, size) {
    let value = 0.0;
    let initialSize = size;
    while (size >= 1) {
        value += smoothNoise(x / size, y / size) * size;
        size /= 2.0;
    }
    return (128.0 * value / initialSize);
}
function initTexture(width, height) {
    checkerTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, checkerTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
}
// ----------------------------------------
//  MARBLE TEXTURE
// ----------------------------------------
export function makeMarbleTexture(width, height) {
    generateNoise();
    const pixels = new Uint8ClampedArray(width * height * 4);
    const xPeriod = 5.0;
    const yPeriod = 10.0;
    const turbPower = 5.0;
    const turbSize = 32.0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let xyValue = x * xPeriod / noiseWidth + y * yPeriod / noiseHeight + turbPower * turbulence(x, y, turbSize) / 256.0;
            let sineValue = 256 * Math.abs(Math.sin(xyValue * 3.14159));
            let c = Math.floor(sineValue);
            pixels[4 * (width * y + x)] = c;
            pixels[4 * (width * y + x) + 1] = c;
            pixels[4 * (width * y + x) + 2] = c;
            pixels[4 * (width * y + x) + 3] = 255;
        }
    }
    gl.bindTexture(gl.TEXTURE_2D, checkerTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
}
function update() {
    generateNoise();
    makeMarbleTexture(512, 512);
    requestAnimationFrame(render);
}
//draw a frame
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //position camera 10 units back from origin
    mv = lookAt(new vec4(0, 0, 5, 1), new vec4(0, 0, 0, 1), new vec4(0, 1, 0, 0));
    //rotate if the user has been dragging the mouse around
    mv = mv.mult(rotateY(yAngle).mult(rotateX(xAngle)));
    //send the modelview matrix over
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    //make sure the appropriate texture is sitting on texture unit 0
    //we could do this once since we only have one texture, but eventually you'll have multiple textures
    //so you'll be swapping them in and out for each object
    gl.activeTexture(gl.TEXTURE0); //we're using texture unit 0
    gl.bindTexture(gl.TEXTURE_2D, checkerTex); //we want checkerTex on that texture unit
    //when the shader runs, the sampler2D will want to know what texture unit the texture is on
    //It's on texture unit 0, so send over the value 0
    gl.uniform1i(uTextureSampler, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
}
//# sourceMappingURL=maketexturefunctions.js.map