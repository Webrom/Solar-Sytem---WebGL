/**
 * Created by Romain on 23/04/2016.
 */

//GLOBALS
var gl;
var shaderProgram;

var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();

//textures
var textures = [];

//interaction
var drawStyle;

var userRotationMatrix = mat4.create();
mat4.identity(userRotationMatrix);

var rTri = 0;
var rSquare = 0;
var rSphere = 0;

var lastTime = 0;
var mouseDown = false;
var lastMouseX = null;
var lastMouseY = null;
var currentZoom = 1;

var toggleTriangle = true;
var toggleSquare= true;
var toggleSphere= true;

var camX = 0;
var camZ = 0;
var camHeight = 0;

//world
var objects = [];
var rootObject;

//geometry
var pasLat = 3;
var pasLong = 6;
var tetaMax = 360;
var phiMax = 90;



//SHADERS
function initGL(canvas)
{
    try
    {
        gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {}
    if (!gl)
    {
        alert("Could not initialise WebGL, sorry :-(");
    }
}

function getShader(gl, id)
{
    var shaderScript = document.getElementById(id);
    if (!shaderScript)
    {
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k)
    {
        if (k.nodeType == 3)
        {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment")
    {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex")
    {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex")
    {
        shader = gl.createShader(gl.VERTEX_SHADER);
    }
    else
    {
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

function initShaders()
{
    var fragmentShader = getShader(gl, "shader-fs");
    var vertexShader = getShader(gl, "shader-vs");

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS))
    {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
}

function mvPushMatrix()
{
    var copy = mat4.create();
    mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
}

function mvPopMatrix()
{
    if (mvMatrixStack.length == 0)
    {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

function setMatrixUniforms()
{
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}


//TEXTURES
function initTexture()
{
    createTexture(0,"./img/sun.jpg");
    createTexture(1,"./img/earth.jpg");
    createTexture(2,"./img/moon.gif");
    //textures[0].image.src = "./img/sun.jpg";
    //textures[1].image.src = "./img/earth.jpg";
    //textures[2].image.src = "./img/moon.gif";
}

function createTexture(i,src){
    textures[i] = gl.createTexture();
    textures[i].image = new Image();
    textures[i].image.onload = function()
    {
        handleLoadedTexture(textures[i])
    }
    textures[i].image.src = src;
}

function handleLoadedTexture(texture)
{
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
}


//INITGL

function degToRad(degrees)
{
    return degrees * Math.PI / 180;
}


function pol2Cart(longi, lat, R)
{
    return [
        R *Math.cos(degToRad(lat))*Math.sin(degToRad(longi)),
        R * Math.sin(degToRad(lat)),
        R *Math.cos(degToRad(lat))*Math.cos(degToRad(longi))
    ];
}

function drawScene()
{
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);
    mat4.identity(mvMatrix);

    mat4.rotate(mvMatrix, -camHeight, [1, 0, 0]);

    mat4.translate(mvMatrix, [camX, 0.0, camZ]);
    mat4.translate(mvMatrix, [0, 0.0, -10.0]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[0]);
    gl.uniform1i(shaderProgram.samplerUniform, 0);

    rootObject.draw();
}

function initWorldObjects()
{
    var obj = 12;

    rootObject = new sphere(null,2);
    rootObject.translate([0,0,0.0]);
    objects.push(rootObject);
    rootObject.texture = textures[0];
    //rootObject.scale(1);

    var earth = new sphere(rootObject,1);
    objects.push(earth);
    earth.translate([3,0,0]);
    earth.texture = textures[1];

    var moon = new sphere(earth,1);
    objects.push(moon);
    moon.translate([2,0,0]);
    moon.texture = textures[2];

    return rootObject;
}

function animate()
{
    var timeNow = new Date().getTime();
    var elapsed = 0;
    if (lastTime != 0)
    {
        elapsed = timeNow - lastTime;

        rTri += (90 * elapsed) / 1000.0;
        rSquare += (75 * elapsed) / 1000.0;
        rSphere += (50 * elapsed) / 1000.0;
    }
    rootObject.animate(elapsed);
    lastTime = timeNow;
}

function tick() {
    requestAnimFrame(tick);
    drawScene();
    animate();
}

function webGLStart() {

    var canvas = document.getElementById("lesson03-canvas");

    //webGL
    initGL(canvas);
    initShaders();
    initTexture();
    rootObject = initWorldObjects();


    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    //interactions
    canvas.onmousedown = handleMouseDown;
    document.onmouseup = handleMouseUp;
    document.onmousemove = handleMouseMove;
    canvas.onmousewheel = handleWheel;
    window.addEventListener("keydown", handleKeyDown, false);
    drawStyle = gl.TRIANGLES;
    tick();
}

//interactions
function handleMouseDown(event) {
    mouseDown = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
}

function handleMouseUp(event) {
    mouseDown = false;
}

function handleMouseMove(event)
{
    if (!mouseDown) {
        return;
    }
    var newX = event.clientX;
    var newY = event.clientY;


    var newRotationMatrix = mat4.create();
    mat4.identity(newRotationMatrix);

    var deltaX = newX - lastMouseX;
    mat4.rotate(newRotationMatrix, degToRad(deltaX / 7), [0, 1, 0]);

    var deltaY = newY - lastMouseY;
    mat4.rotate(newRotationMatrix, degToRad(deltaY / 7), [1, 0, 0]);

    mat4.multiply(newRotationMatrix, userRotationMatrix, userRotationMatrix);

    lastMouseX = newX;
    lastMouseY = newY;

}

function handleWheel(event)
{
    event.preventDefault();
    currentZoom*=1+(event.wheelDelta/Math.abs(event.wheelDelta))/10;
}

function handleKeyDown(event)
{
    //console.log(event.keyCode);
    event.preventDefault();
    switch(event.keyCode)
    {
        case 37: //left
            camX++;
            break;
        case 39: //right
            camX--;
            break;
        case 38: //down
            camZ++;
            break;
        case 40: //forward
            camZ--;
            break;
        case 33: //pageUp
            camHeight+=degToRad(1);
            break;
        case 34: //pageDown
            camHeight-=degToRad(1);
            break;

        default:

    }
}


function drawCombo(list)
{
    drawStyle = list.selectedIndex;
}

function handleClick(checkMesh)
{
    switch(checkMesh.value)
    {
        case 'triangle':
            toggleTriangle = checkMesh.checked;
            break;
        case 'square':
            toggleSquare = checkMesh.checked;
            break;
        case 'sphere':
            toggleSphere = checkMesh.checked;
            break;
        default:
    }
}

function handleSlider1(sliderValue)
{
    //console.log(sliderValue);
}