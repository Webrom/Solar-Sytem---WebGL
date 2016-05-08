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
var skybox;

//geometry
var pasLat = 3;
var pasLong = 6;
var tetaMax = 360;
var phiMax = 90;


var coefRotation = 1;

var lumiereAmbiante = true;


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

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
    shaderProgram.useLightingUniform = gl.getUniformLocation(shaderProgram, "uUseLighting");
    shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");
    shaderProgram.pointLightingLocationUniform = gl.getUniformLocation(shaderProgram, "uPointLightingLocation");
    shaderProgram.pointLightingColorUniform = gl.getUniformLocation(shaderProgram, "uPointLightingColor");
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
    var normalMatrix = mat3.create();
    mat4.toInverseMat3(mvMatrix, normalMatrix);
    mat3.transpose(normalMatrix);
    gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
}


//TEXTURES
function initTexture()
{
    createTexture(0,"./img/sun.jpg");
    createTexture(1,"./img/earth.jpg");
    createTexture(2,"./img/moon.gif");
    createTexture(3,"./img/mars.jpg");
    createTexture(4,"./img/stars.jpg");
    createTexture(5,"./img/jupiter.jpg");
    createTexture(6,"./img/mercure.jpg");
    createTexture(7,"./img/saturn.png");
    createTexture(8,"./img/venus.jpg");
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


function pol2Cart(longi, lat, resLongi, resLat)
{
    return [
        Math.cos(degToRad(lat))*Math.sin(degToRad(longi)),
        Math.sin(degToRad(lat)),
        Math.cos(degToRad(lat))*Math.cos(degToRad(longi))
    ];
}

function pol2CartNormal(longi, lat, dir)
{
    return [
        Math.cos(degToRad(lat))*Math.sin(degToRad(longi))*dir,
        Math.sin(degToRad(lat))*dir,
        Math.cos(degToRad(lat))*Math.cos(degToRad(longi))*dir
    ];
}

function drawScene()
{
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 1000.0, pMatrix);
    mat4.identity(mvMatrix);
    gl.disable(gl.DEPTH_TEST);
    skybox.draw();
    gl.enable(gl.DEPTH_TEST);

    mat4.rotate(mvMatrix, -camHeight, [1, 0, 0]);

    mat4.translate(mvMatrix, [camX, 0.0, camZ]);
    mat4.translate(mvMatrix, [0, 0.0, -100.0]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[0]);
    gl.uniform1i(shaderProgram.samplerUniform, 0);
    if(lumiereAmbiante) {
        gl.uniform3f(shaderProgram.ambientColorUniform, $('#intensityLight').val(), $('#intensityLight').val(), $('#intensityLight').val());
    }else {
        gl.uniform3f(shaderProgram.ambientColorUniform, 0, 0, 0);
    }
    rootObject.draw();
}

function initWorldObjects()
{
    var obj = 12;

    skybox = new sphere(null);
    skybox.translate([0,0,0]);
    objects.push(skybox);
    skybox.texture = textures[4];
    //skybox.scale([50,50,50]);
    skybox.coefOrbite = 0;
    skybox.coefRevolution = 0;


    rootObject = new sphere(null,-1);
    rootObject.translate([0,0,0]);
    objects.push(rootObject);
    rootObject.texture = textures[0];
    rootObject.scale([4,4,4]);
    rootObject.coefOrbite = 0;
    rootObject.coefRevolution = 1;

    var earth = new sphere(rootObject);
    objects.push(earth);
    earth.translate([3,0,0]);
    earth.texture = textures[1];
    earth.scale([0.5,0.5,0.5]);
    earth.coefOrbite = 0.4;
    earth.coefRevolution = 2;

    var moon = new sphere(earth);
    objects.push(moon);
    moon.translate([1.5,0,0]);
    moon.texture = textures[2];
    moon.scale([0.3,0.3,0.3]);
    moon.coefOrbite = 8;
    moon.coefRevolution = 6;

    var mars = new sphere(rootObject);
    objects.push(mars);
    mars.translate([5,0,0]);
    mars.texture = textures[3];
    mars.scale([0.4,0.4,0.4]);
    mars.coefOrbite = 1;
    mars.coefRevolution = 4;

    var jupiter = new sphere(rootObject);
    objects.push(jupiter);
    jupiter.translate([8,0,0]);
    jupiter.texture = textures[5];
    jupiter.scale([0.7,0.7,0.7]);
    jupiter.coefOrbite = 0.5;
    jupiter.coefRevolution = 3;

    var mercure = new sphere(rootObject);
    objects.push(jupiter);
    mercure.translate([10,0,0]);
    mercure.texture = textures[6];
    mercure.scale([0.6,0.6,0.6]);
    mercure.coefOrbite = 0.7;
    mercure.coefRevolution = 12;

    var saturn = new sphere(rootObject);
    objects.push(jupiter);
    saturn.translate([12,0,0]);
    saturn.texture = textures[7];
    saturn.scale([0.8,0.8,0.8]);
    saturn.coefOrbite = 0.2;
    saturn.coefRevolution = 2;

    var venus = new sphere(rootObject);
    objects.push(jupiter);
    venus.translate([15,0,0]);
    venus.texture = textures[8];
    venus.scale([0.2,0.2,0.2]);
    venus.coefOrbite = 1;
    venus.coefRevolution = 2;

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
    rootObject.animate(elapsed*coefRotation);
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
            camX+=10;
            break;
        case 39: //right
            camX-=10;
            break;
        case 38: //down
            camZ+=10;
            break;
        case 40: //forward
            camZ-=10;
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
        case 'lumiere':
            lumiereAmbiante = checkMesh.checked;
            if (lumiereAmbiante){
                $('#intensityLumiereAmbiante').removeClass('hidden');
            }else {
                $('#intensityLumiereAmbiante').addClass('hidden');
            }
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
    coefRotation = sliderValue;
}