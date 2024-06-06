import * as THREE from 'three';
import { OrbitControls } from './OrbitControls.js';
import { GLTFLoader } from './GLTFLoader.js';

let scene, camera, renderer, controls;
let keyboard = {};
const moveSpeed = 0.1;
const models = []; // Store models for raycasting

init();

async function init() {
    // Load configuration
    const config = await fetch("config.json").then(response => response.json());

    // Create the scene
    scene = new THREE.Scene();

    // Set sky color to light blue
    // Load and set background if not empty
    if (config.background !== "") {
        const bgTexture = new THREE.TextureLoader().load(config.background);
        scene.background = bgTexture;
    } else {
        scene.background = new THREE.Color(0x87CEEB);
    }
    // Create the camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth - 20, window.innerHeight - 20);
    document.body.appendChild(renderer.domElement);

    // Orbit controls
    controls = new OrbitControls(camera, renderer.domElement);

    // Add ambient light (white)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // White light with half intensity
    scene.add(ambientLight);

    // Add directional light for better object shading
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    // Add ground plane (dirt yellow color)
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshPhongMaterial({ color: 0xD2B48C, depthWrite: false });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotate the ground to be horizontal
    ground.position.y = 0;
    scene.add(ground);

    // Load objects specified in the JSON file
    loadObjects(config.objects);

    // Handle resizing
    window.addEventListener('resize', onWindowResize, false);

    // Handle keyboard events
    window.addEventListener('keydown', (event) => {
        keyboard[event.code] = true;
    });

    window.addEventListener('keyup', (event) => {
        keyboard[event.code] = false;
    });

    // Handle mouse click events
    window.addEventListener('click', onMouseClick, false);

    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

async function loadObjects(objects) {
    const loader = new GLTFLoader();
    for (const objConfig of objects) {
        const model = await loader.loadAsync(objConfig.model);

        // Set position
        model.scene.position.set(objConfig.position.x, objConfig.position.y, objConfig.position.z);

        // Set rotation
        model.scene.rotation.set(objConfig.rotation.x, objConfig.rotation.y, objConfig.rotation.z);

        scene.add(model.scene);
        models.push(model.scene); // Push the loaded model to models array
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (keyboard['KeyW']) {
        camera.position.add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(moveSpeed));
    }
    if (keyboard['KeyS']) {
        camera.position.add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-moveSpeed));
    }
    if (keyboard['KeyA']) {
        const left = new THREE.Vector3().crossVectors(camera.up, camera.getWorldDirection(new THREE.Vector3())).normalize();
        camera.position.add(left.multiplyScalar(-moveSpeed));
    }
    if (keyboard['KeyD']) {
        const right = new THREE.Vector3().crossVectors(camera.up, camera.getWorldDirection(new THREE.Vector3())).normalize();
        camera.position.add(right.multiplyScalar(moveSpeed));
    }

    controls.update();

    renderer.render(scene, camera);
}

function onMouseClick(event) {
    event.preventDefault();

    // Calculate mouse position in normalized device coordinates (-1 to +1) for both components.
    const mouse = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1
    };

    // Raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(models, true);

    if (intersects.length > 0) {
        const target = intersects[0].object;
        const targetPosition = new THREE.Vector3();
        target.getWorldPosition(targetPosition);

        // Move camera to a point above the clicked model
        const newCameraPosition = targetPosition.clone().add(new THREE.Vector3(0, 2, 0)); // 2 units above the model
        camera.position.set(newCameraPosition.x, newCameraPosition.y, newCameraPosition.z);
        controls.target.set(targetPosition.x, targetPosition.y, targetPosition.z);
    }
}