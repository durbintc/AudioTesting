import { initShaders, vec4, flatten, lookAt, translate, perspective } from "./helperfunctions.js";
let gl;
let canvas;
let program;
let bufferId;
let umv;
let uproj;
let audioUniformLocation;
const audioCtx = new AudioContext();
const audio = document.getElementById("music");
const src = audioCtx.createMediaElementSource(audio);
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 1024;
const dataArray = new Uint8Array(analyser.frequencyBinCount);
src.connect(analyser);
analyser.connect(audioCtx.destination);
let r = 0;
let g = 0;
let b = 0;
//do this immediately when the webpage loads
window.onload = function init() {
    canvas = document.getElementById("glCanvas");
    //and the canvas has a webgl rendering context associated already
    gl = canvas.getContext("webgl2");
    if (!gl) {
        alert("WebGL program not supported!");
    }
    //use the helperfunction function to turn vertex and fragment shader into program
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    audioUniformLocation = gl.getUniformLocation(program, "audioUniformLocation");
    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");
    gl.useProgram(program);
    document.getElementById("start").addEventListener("click", () => {
        audioCtx.resume();
        audio.play();
        console.log("yup");
        //render();
    });
    //TODO come back here in a few minutes
    makeTriangleAndBuffer();
    //what part of the canvas should we use (all of it here)
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    //request a frame to be drawn
    window.setInterval(update, 16);
};
function makeTriangleAndBuffer() {
    let trianglePoints = [];
    //create 3 vertices and add to local array
    //we haven't discussed projection, so stay between -1 and 1
    trianglePoints.push(new vec4(-0.5, -0.5, 0, 1));
    trianglePoints.push(new vec4(1, 0, 0, 1));
    trianglePoints.push(new vec4(0, 0.5, 0, 1));
    trianglePoints.push(new vec4(0, 1, 0, 1));
    trianglePoints.push(new vec4(0.5, -0.5, 0, 1));
    trianglePoints.push(new vec4(0, 0, 1, 1));
    //get some graphics card memory
    bufferId = gl.createBuffer();
    //tell webGL that the buffer we just created is the one to work with rn
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    //send the local data over to the graphics card
    //flatten converts to 1d array
    gl.bufferData(gl.ARRAY_BUFFER, flatten(trianglePoints), gl.STATIC_DRAW);
    //x=0-3 y=4-7 z=8-11 w=12-15 r=16-19 g=20-23 b=24-27 a=28-31
    //tell openGL what the data means
    let vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(vPosition);
    let vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 32, 16);
    gl.enableVertexAttribArray(vColor);
}
function update() {
    analyser.getByteFrequencyData(dataArray);
    // Split frequency bands
    const low = dataArray.slice(0, 171).reduce((a, b) => a + b, 0) / 171;
    const mid = dataArray.slice(171, 342).reduce((a, b) => a + b, 0) / 171;
    const high = dataArray.slice(342).reduce((a, b) => a + b, 0) / (dataArray.length - 342);
    // Map to 0–1 range
    r = (low / 50) - 1;
    g = mid / 255;
    b = (high / 50) - 1;
    console.log(r);
    console.log(g);
    console.log(b);
    requestAnimationFrame(render);
}
function render() {
    //start by clearing all buffers
    gl.clear(gl.COLOR_BUFFER_BIT);
    let p = perspective(45, canvas.clientWidth / canvas.clientHeight, 1.0, 50.0);
    gl.uniformMatrix4fv(uproj, false, p.flatten());
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    let mv = lookAt(new vec4(0, 5, 10, 1), new vec4(0, 0, 0, 1), new vec4(0, 1, 0, 0));
    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
    gl.uniform1f(audioUniformLocation, avg / 255.0);
    mv = mv.mult(translate(r, b, 0));
    console.log(dataArray);
    //if needed to we could bind to the correct drawing buffer
    //but if we're already bound to it, this would have no impact
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
}
