/* ===== WIGLO — THREE.JS 3D BACKGROUND =====
   Warm gold wireframe shapes, mouse parallax, scroll depth, section pulses.
   Per the Cool_BackGround_Key guide.
*/

document.addEventListener('DOMContentLoaded', () => {
    initThreeBackground();
});

function initThreeBackground() {
    if (typeof THREE === 'undefined') {
        console.warn('Three.js not loaded — 3D background skipped');
        return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    // ── CONFIG ──────────────────────────────────────────
    const ACCENT_HEX   = 0xd4a574;   // warm gold
    const SHAPE_COUNT  = 15;
    const SPREAD       = 100;
    const BASE_OPACITY = 0.13;
    const CAMERA_Z     = 30;
    const MOUSE_FACTOR = 5;
    const LERP_FACTOR  = 0.05;
    const SCROLL_DEPTH = 20;
    // ────────────────────────────────────────────────────

    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(
        75, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    camera.position.setZ(CAMERA_Z);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // ── GEOMETRIES ──────────────────────────────────────
    const geometryPool = [
        new THREE.TorusGeometry(10, 3, 16, 100),
        new THREE.OctahedronGeometry(8),
        new THREE.IcosahedronGeometry(7),
        new THREE.TetrahedronGeometry(8)
    ];

    // ── BASE MATERIAL ───────────────────────────────────
    const baseMaterial = new THREE.MeshStandardMaterial({
        color:       ACCENT_HEX,
        wireframe:   true,
        transparent: true,
        opacity:     BASE_OPACITY
    });

    // ── POPULATE ────────────────────────────────────────
    const shapes = [];
    for (let i = 0; i < SHAPE_COUNT; i++) {
        const geo  = geometryPool[Math.floor(Math.random() * geometryPool.length)];
        const mat  = baseMaterial.clone();
        const mesh = new THREE.Mesh(geo, mat);

        mesh.position.set(
            THREE.MathUtils.randFloatSpread(SPREAD),
            THREE.MathUtils.randFloatSpread(SPREAD),
            THREE.MathUtils.randFloatSpread(SPREAD)
        );
        mesh.rotation.x = Math.random() * Math.PI;
        mesh.rotation.y = Math.random() * Math.PI;

        mesh.userData.rotationSpeed = {
            x: (Math.random() - 0.5) * 0.009,
            y: (Math.random() - 0.5) * 0.009
        };

        scene.add(mesh);
        shapes.push(mesh);
    }

    // ── LIGHTING ────────────────────────────────────────
    const pointLight  = new THREE.PointLight(ACCENT_HEX, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    // ── MOUSE ───────────────────────────────────────────
    let mouseX  = 0, mouseY  = 0;
    let targetX = 0, targetY = 0;
    document.addEventListener('mousemove', e => {
        mouseX = (e.clientX / window.innerWidth)  *  2 - 1;
        mouseY = (e.clientY / window.innerHeight) * -2 + 1;
    });

    // ── SCROLL ──────────────────────────────────────────
    window.addEventListener('scroll', () => {
        const t = window.pageYOffset /
            Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        camera.position.z = CAMERA_Z + t * SCROLL_DEPTH;
    });

    // ── ANIMATION LOOP ──────────────────────────────────
    function animate() {
        requestAnimationFrame(animate);
        targetX += (mouseX - targetX) * LERP_FACTOR;
        targetY += (mouseY - targetY) * LERP_FACTOR;
        camera.position.x = targetX * MOUSE_FACTOR;
        camera.position.y = targetY * MOUSE_FACTOR;
        camera.lookAt(scene.position);
        shapes.forEach(s => {
            s.rotation.x += s.userData.rotationSpeed.x;
            s.rotation.y += s.userData.rotationSpeed.y;
        });
        renderer.render(scene, camera);
    }
    animate();

    // ── RESIZE ──────────────────────────────────────────
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ── SECTION PULSE ───────────────────────────────────
    const sectionObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) pulseShapes(); });
    }, { threshold: 0.2 });

    document.querySelectorAll('.section, section, .view').forEach(el => {
        sectionObserver.observe(el);
    });

    function pulseShapes() {
        shapes.forEach((shape, i) => {
            setTimeout(() => {
                let t = 0;
                const id = setInterval(() => {
                    t += 0.06;
                    shape.material.opacity = BASE_OPACITY + Math.sin(t * Math.PI) * 0.09;
                    if (t >= 1) { clearInterval(id); shape.material.opacity = BASE_OPACITY; }
                }, 16);
            }, i * 55);
        });
    }

    // ── THEME COLOR UPDATE ───────────────────────────────
    window.updateThreeBgColor = (hex) => {
        shapes.forEach(s => s.material.color.setHex(hex));
        pointLight.color.setHex(hex);
    };

    // ── MOBILE REDUCTION ────────────────────────────────
    if (navigator.hardwareConcurrency < 4 || window.innerWidth < 768) {
        shapes.forEach((s, i) => { if (i >= Math.floor(SHAPE_COUNT / 2)) s.visible = false; });
    }
}
