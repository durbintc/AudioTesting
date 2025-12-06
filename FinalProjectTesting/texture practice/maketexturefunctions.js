"use strict";
import { initFileShaders, perspective, vec2, vec4, flatten, lookAt, rotateX, rotateY, translate, scalem } from '../helperfunctions.js';
let gl;
let program;
let marbleTex;
let graphTex;
let turbTex;
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
let zoom = 25;
let noiseWidth = 512;
let noiseHeight = 512;
let noise;
let bass = 0;
let mid = 0;
let high = 0;
let r = 0;
let g = 0;
let b = 0;
let colorMode = false;
let mode = [1, 1, 1];
let marbleMode = true;
let turbMode = false;
let lowLimit = 100;
let midLimit = 200;
let highLimit = 300;
const audioCtx = new AudioContext();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 1024;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);
// *****************************************
// Set to true to listen to spotify/mic data
// (Requires extra setup and software)
// Set too false to listen to mp3 in html
// (No extra set up required)
// *****************************************
let spotify = true;
let audioSource;
window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext('webgl2', { antialias: true });
    if (!gl) {
        alert("WebGL isn't available");
    }
    // Set up audio source AFTER page loads
    if (spotify) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
            audioSource = audioCtx.createMediaStreamSource(stream);
            audioSource.connect(analyser);
            analyser.connect(audioCtx.destination);
            console.log("Microphone connected!");
        })
            .catch(err => {
            console.error("Microphone access denied:", err);
        });
    }
    else {
        const audio = document.getElementById("music");
        audioSource = audioCtx.createMediaElementSource(audio);
        audioSource.connect(analyser);
        analyser.connect(audioCtx.destination);
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
    initBaseNoise();
    marbleTex = initTexture(256, 256);
    graphTex = initTexture(256, 256);
    turbTex = initTexture(256, 256);
    makeSquareAndBuffer();
    //initialize rotation angles
    xAngle = 0;
    yAngle = 0;
    document.getElementById("start").addEventListener("click", () => {
        audioCtx.resume().then(() => {
            if (!spotify) {
                const audio = document.getElementById("music");
                audio.play();
            }
            console.log("Started!");
        });
    });
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
            case "r":
                r++;
                break;
            case "g":
                g++;
                break;
            case "b":
                b++;
                break;
            case "m":
                marbleMode = !marbleMode;
                break;
            case "c":
                colorMode = !colorMode;
                break;
            case "t":
                turbMode = !turbMode;
                break;
            case "1":
                mode[0] ^= 1;
                break;
            case "2":
                mode[1] ^= 1;
                break;
            case "3":
                mode[2] ^= 1;
                break;
        }
        p = perspective(zoom, (canvas.clientWidth / canvas.clientHeight), 1, 20);
        gl.uniformMatrix4fv(uproj, false, p.flatten());
        requestAnimationFrame(render); //and now we need a new frame since we made a change
    });
    window.setInterval(update, 32);
    requestAnimationFrame(render);
};
//Make a square and send it over to the graphics card
function makeSquareAndBuffer() {
    let squarePoints = []; //empty array
    let a = 1;
    let b = 1;
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
// Call this once during init
function initBaseNoise() {
    noise = [];
    for (let y = 0; y < noiseHeight; y++) {
        noise[y] = [];
        for (let x = 0; x < noiseWidth; x++) {
            noise[y][x] = Math.random();
        }
    }
}
// Smooth noise function
// Linear interpolation for zooming in and out
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
// Creates more natural features in smoothed noise by rerunning calculations on smaller and smaller subsections
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
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return texture;
}
function update() {
    analyser.getByteFrequencyData(dataArray);
    bass = dataArray.slice(0, lowLimit).reduce((a, b) => a + b, 0) / lowLimit / 255 * 2;
    mid = dataArray.slice(lowLimit, midLimit).reduce((a, b) => a + b, 0) / (midLimit - lowLimit) / 255 * 2;
    high = dataArray.slice(midLimit, highLimit).reduce((a, b) => a + b, 0) / (highLimit - midLimit) / 255 * 2;
    // Calculate all textures in one pass with cached turbulence values
    makeAllTextures(256, 256);
    requestAnimationFrame(render);
}
function makeAllTextures(width, height) {
    const marblePixels = new Uint8ClampedArray(width * height * 4);
    const octavePixels = new Uint8ClampedArray(width * height * 4);
    const graphPixels = new Uint8ClampedArray(width * height * 4);
    // Marble constants
    let xPeriod = 5.0;
    let yPeriod = 10.0;
    let turbPower = 2;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Calculate turbulence values ONCE per pixel
            let bassNoise = mode[0] ? turbulence(x, y, 64) * bass : 0;
            let midNoise = mode[1] ? turbulence(x, y, 16) * mid : 0;
            let highNoise = mode[2] ? turbulence(x, y, 4) * high : 0;
            let combinedTurb = bassNoise + midNoise + highNoise;
            let idx = 4 * (width * y + x);
            // MARBLE TEXTURE
            let xyValue = x * xPeriod / noiseWidth + y * yPeriod / noiseHeight + turbPower * combinedTurb / 256.0;
            let sineValue = 256 * Math.abs(Math.sin(xyValue * 3.14159));
            let c = turbMode ? Math.floor(combinedTurb) : Math.floor(sineValue);
            let cr = colorMode ? bass * 100 : 0;
            let cg = colorMode ? mid * 100 : 0;
            let cb = colorMode ? high * 100 : 0;
            marblePixels[idx] = cr + c + r;
            marblePixels[idx + 1] = cg + c + g;
            marblePixels[idx + 2] = cb + c + b;
            marblePixels[idx + 3] = 255;
            // OCTAVE TEXTURE
            octavePixels[idx] = Math.floor(bassNoise);
            octavePixels[idx + 1] = Math.floor(midNoise);
            octavePixels[idx + 2] = Math.floor(highNoise);
            octavePixels[idx + 3] = 255;
            // GRAPH TEXTURE (frequency visualization)
            let audioIndex = Math.floor((x / width) * bufferLength);
            let value = dataArray[audioIndex];
            let barHeight = (value / 255) * height;
            let brightness = y < barHeight ? value : 0;
            graphPixels[idx] = brightness;
            graphPixels[idx + 1] = brightness;
            graphPixels[idx + 2] = brightness;
            graphPixels[idx + 3] = 255;
        }
    }
    // Upload all textures
    gl.bindTexture(gl.TEXTURE_2D, marbleTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, marblePixels);
    gl.bindTexture(gl.TEXTURE_2D, turbTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, octavePixels);
    gl.bindTexture(gl.TEXTURE_2D, graphTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, graphPixels);
}
//draw a frame
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //position camera 10 units back from origin
    let base = lookAt(new vec4(0, 0, 3, 1), new vec4(0, 0, 0, 1), new vec4(0, 1, 0, 0));
    //rotate if the user has been dragging the mouse around
    mv = base.mult(rotateY(yAngle).mult(rotateX(xAngle)).mult(translate(-1.25, 0, 0)).mult(scalem(.6, .6, .6)));
    //send the modelview matrix over
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    //make sure the appropriate texture is sitting on texture unit 0
    //we could do this once since we only have one texture, but eventually you'll have multiple textures
    //so you'll be swapping them in and out for each object
    gl.activeTexture(gl.TEXTURE0); //we're using texture unit 0
    gl.bindTexture(gl.TEXTURE_2D, marbleTex); //we want marbleTex on that texture unit
    //when the shader runs, the sampler2D will want to know what texture unit the texture is on
    //It's on texture unit 0, so send over the value 0
    gl.uniform1i(uTextureSampler, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    mv = base.mult(rotateY(yAngle).mult(rotateX(xAngle)).mult(translate(1.25, 0, 0)).mult(scalem(.6, .6, .6)));
    //send the modelview matrix over
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    //make sure the appropriate texture is sitting on texture unit 0
    //we could do this once since we only have one texture, but eventually you'll have multiple textures
    //so you'll be swapping them in and out for each object
    gl.activeTexture(gl.TEXTURE0); //we're using texture unit 0
    gl.bindTexture(gl.TEXTURE_2D, graphTex); //we want marbleTex on that texture unit
    //when the shader runs, the sampler2D will want to know what texture unit the texture is on
    //It's on texture unit 0, so send over the value 0
    gl.uniform1i(uTextureSampler, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    mv = base.mult(rotateY(yAngle).mult(rotateX(xAngle)).mult(translate(0, 0, 0)).mult(scalem(.6, .6, .6)));
    //send the modelview matrix over
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    //make sure the appropriate texture is sitting on texture unit 0
    //we could do this once since we only have one texture, but eventually you'll have multiple textures
    //so you'll be swapping them in and out for each object
    gl.activeTexture(gl.TEXTURE0); //we're using texture unit 0
    gl.bindTexture(gl.TEXTURE_2D, turbTex); //we want marbleTex on that texture unit
    //when the shader runs, the sampler2D will want to know what texture unit the texture is on
    //It's on texture unit 0, so send over the value 0
    gl.uniform1i(uTextureSampler, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
}
//# sourceMappingURL=maketexturefunctions.js.map