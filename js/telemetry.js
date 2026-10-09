/**
 * Telemetry: the 3D radar globe in the hero (Three.js).
 *
 *  - A dark glass sphere with a faint latitude/longitude graticule and points for major cities,
 *    lit from where the sun really is right now.
 *  - An amber beacon at Kampala that pulses.
 *  - A dashed 24-hour orbit around the globe on the visitor's clock (00 nearest the viewer, 06 to the
 *    left, 12 at the back, 18 to the right), with Kevin's working day in amber and the visitor's in
 *    soft white.
 *  - A low-poly plane flying the orbit at the current hour. Drag it (or the orbit) to compare any
 *    hour; the camera leans a little towards the pointer. Letting go hands back to js/hours.js,
 *    which springs it back to now.
 *
 * Replaces the flat SVG dial only after the first frame has drawn. Without WebGL it never starts.
 */
import { flight } from "./hours.js";
import { subsolarPoint, toVector } from "./sun.js";

const root = document.querySelector("[data-telemetry]");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const KAMPALA = { lat: 0.35, lon: 32.58 };
const RING_R = 1.72;
const TAU = Math.PI * 2;
const COLORS = { cloud: 0xe8e8e6, amber: 0xff8c00, transit: 0x4a90e2, glass: 0x0e1016 };

// Major cities, as [lat, lon]. Enough to read as a planet at a glance; not a data set.
const CITIES = [
  [51.5, -0.13], [48.86, 2.35], [52.52, 13.4], [40.42, -3.7], [41.9, 12.5], [55.75, 37.62], [59.33, 18.07],
  [30.04, 31.24], [6.52, 3.38], [-1.29, 36.82], [-26.2, 28.05], [-33.92, 18.42], [9.03, 38.74], [-6.79, 39.21],
  [33.57, -7.59], [14.69, -17.44], [5.6, -0.19], [-4.32, 15.31], [15.5, 32.56], [-1.94, 30.06], [25.2, 55.27],
  [24.71, 46.68], [41.01, 28.98], [35.69, 51.39], [28.61, 77.21], [19.08, 72.88], [13.08, 80.27], [23.81, 90.41],
  [13.75, 100.5], [1.35, 103.82], [-6.21, 106.85], [22.32, 114.17], [31.23, 121.47], [39.9, 116.4], [37.57, 126.98],
  [35.68, 139.69], [14.6, 120.98], [-33.87, 151.21], [-37.81, 144.96], [-36.85, 174.76], [40.71, -74.0],
  [43.65, -79.38], [41.88, -87.63], [34.05, -118.24], [37.77, -122.42], [19.43, -99.13], [4.71, -74.07],
  [-12.05, -77.04], [-23.55, -46.63], [-34.6, -58.38], [-33.45, -70.67], [64.15, -21.94], [21.31, -157.86],
];

if (root && !root.classList.contains("has-3d")) start();

async function start() {
  let THREE;
  try {
    THREE = await import("./vendor/three.min.js");
  } catch {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return; // No WebGL: the flat dial stays.
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const CAMERA_HOME = new THREE.Vector3(0, 0.55, 7.4);
  camera.position.copy(CAMERA_HOME);
  camera.lookAt(0, 0, 0);

  const vec = (lat, lon, r = 1) => new THREE.Vector3(...toVector(lat, lon)).multiplyScalar(r);

  // --- Globe ----------------------------------------------------------------------------------
  // Turn the globe so Kampala faces the viewer, a little left of centre and slightly above.
  const globe = new THREE.Group();
  const facing = new THREE.Vector3(-0.32, 0.18, 1).normalize();
  globe.quaternion.setFromUnitVectors(vec(KAMPALA.lat, KAMPALA.lon), facing);
  scene.add(globe);

  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 48),
      new THREE.MeshPhysicalMaterial({
        color: COLORS.glass,
        roughness: 0.32,
        metalness: 0.2,
        clearcoat: 1,
        clearcoatRoughness: 0.25,
        transparent: true,
        opacity: 0.94,
      }),
    ),
  );

  // Graticule: parallels and meridians every 15 degrees.
  const grid = [];
  const STEP = 3;
  for (let lat = -75; lat <= 75; lat += 15) {
    for (let lon = -180; lon < 180; lon += STEP) grid.push(vec(lat, lon, 1.003), vec(lat, lon + STEP, 1.003));
  }
  for (let lon = -180; lon < 180; lon += 15) {
    for (let lat = -87; lat < 87; lat += STEP) grid.push(vec(lat, lon, 1.003), vec(lat + STEP, lon, 1.003));
  }
  globe.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(grid),
      new THREE.LineBasicMaterial({ color: COLORS.transit, transparent: true, opacity: 0.16 }),
    ),
  );

  // Cities.
  globe.add(
    new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(CITIES.map(([lat, lon]) => vec(lat, lon, 1.01))),
      new THREE.PointsMaterial({ color: COLORS.cloud, size: 0.028, transparent: true, opacity: 0.75 }),
    ),
  );

  // Kampala: a bright point, a short beam outward, and a ring that pulses on the surface.
  const kla = vec(KAMPALA.lat, KAMPALA.lon, 1.012);
  const klaNormal = kla.clone().normalize();
  globe.add(
    new THREE.Points(
      new THREE.BufferGeometry().setFromPoints([kla]),
      new THREE.PointsMaterial({ color: COLORS.amber, size: 0.075, transparent: true, depthWrite: false }),
    ),
  );
  globe.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([kla, klaNormal.clone().multiplyScalar(1.32)]),
      new THREE.LineBasicMaterial({ color: COLORS.amber, transparent: true, opacity: 0.85 }),
    ),
  );
  const pulse = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.004, 6, 48),
    new THREE.MeshBasicMaterial({ color: COLORS.amber, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  pulse.position.copy(kla);
  pulse.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), klaNormal);
  globe.add(pulse);

  // Light from the sun's real position, so the glass has a day side.
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  const ambient = new THREE.AmbientLight(0x8899bb, 0.6);
  const rim = new THREE.DirectionalLight(COLORS.transit, 1.2);
  rim.position.set(-3, 2, -4);
  scene.add(sun, ambient, rim);
  const placeSun = () => {
    const { lat, lon } = subsolarPoint(new Date());
    sun.position.copy(vec(lat, lon, 6).applyQuaternion(globe.quaternion));
  };
  placeSun();
  setInterval(placeSun, 60_000);

  // --- Orbit ----------------------------------------------------------------------------------
  // The orbit lies in its own XZ plane, tilted towards the viewer so it reads as an ellipse.
  const orbit = new THREE.Group();
  orbit.rotation.x = 0.42;
  orbit.rotation.z = -0.08;
  scene.add(orbit);

  // Hour h to a point on the orbit (local coordinates), radius r.
  const onOrbit = (h, r = RING_R) => {
    const a = (h / 24) * TAU;
    return new THREE.Vector3(-Math.sin(a) * r, 0, Math.cos(a) * r);
  };
  const arcPoints = (start, end, r) => {
    const pts = [];
    const n = Math.max(2, Math.ceil((end - start) * 8));
    for (let i = 0; i <= n; i++) pts.push(onOrbit(start + ((end - start) * i) / n, r));
    return pts;
  };

  const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(arcPoints(0, 24, RING_R).slice(0, -1)),
    new THREE.LineDashedMaterial({ color: COLORS.transit, dashSize: 0.05, gapSize: 0.06, transparent: true, opacity: 0.8 }),
  );
  ring.computeLineDistances();
  orbit.add(ring);

  // Hour ticks: long at 00/06/12/18, short elsewhere.
  const ticks = [];
  for (let h = 0; h < 24; h++) {
    const long = h % 6 === 0;
    ticks.push(onOrbit(h, RING_R - (long ? 0.07 : 0.035)), onOrbit(h, RING_R + (long ? 0.07 : 0.035)));
  }
  orbit.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(ticks),
      new THREE.LineBasicMaterial({ color: COLORS.transit, transparent: true, opacity: 0.9 }),
    ),
  );

  // Working days as arcs just outside (Kevin) and inside (visitor) the orbit.
  const addArcs = (intervals, r, color, opacity) => {
    for (const i of intervals) {
      orbit.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(arcPoints(i.start, i.end, r)),
          new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
        ),
      );
    }
  };
  addArcs(flight.overlap.kevin, RING_R + 0.11, COLORS.amber, 1);
  addArcs(flight.overlap.visitor, RING_R - 0.11, COLORS.cloud, 0.85);

  // --- Plane ----------------------------------------------------------------------------------
  // Low poly, nose along +Z. Flat shading keeps the facets visible.
  const plane = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: COLORS.cloud, roughness: 0.45, metalness: 0.3, flatShading: true });
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.3, 7), body);
  fuselage.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.07, 7), body);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.185;
  const wings = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.008, 0.075), body);
  wings.position.z = 0.02;
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.006, 0.045), body);
  tailplane.position.z = -0.13;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.07, 0.05), body);
  fin.position.set(0, 0.035, -0.13);
  const navLight = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), new THREE.MeshBasicMaterial({ color: COLORS.amber }));
  navLight.position.set(0, 0.075, -0.14);
  plane.add(fuselage, nose, wings, tailplane, fin, navLight);
  plane.scale.setScalar(1.15);
  orbit.add(plane);

  // A generous invisible target around the plane, so it is easy to grab.
  const grab = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
  plane.add(grab);

  // A short contrail behind the plane.
  const TRAIL_HOURS = 1.6;
  const trailGeo = new THREE.BufferGeometry().setFromPoints(arcPoints(0, TRAIL_HOURS, RING_R));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: COLORS.cloud, transparent: true, opacity: 0.35 }));
  orbit.add(trail);

  const FORWARD = new THREE.Vector3(0, 0, 1);
  const placePlane = (h) => {
    const a = (h / 24) * TAU;
    plane.position.copy(onOrbit(h));
    // Direction of travel (increasing hours) in the orbit plane, with a slight bank into the turn.
    const dir = new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a));
    plane.quaternion.setFromUnitVectors(FORWARD, dir);
    plane.rotateZ(-0.35);
    trailGeo.setFromPoints(arcPoints(h - TRAIL_HOURS, h, RING_R));
  };

  // --- Hour labels (HTML, projected from 3D) ---------------------------------------------------
  const tags = [0, 6, 12, 18].map((h) => {
    const el = document.createElement("span");
    el.className = "hour-tag label";
    el.textContent = String(h).padStart(2, "0");
    el.setAttribute("aria-hidden", "true");
    root.append(el);
    return { h, el };
  });
  const projected = new THREE.Vector3();
  const placeTags = () => {
    for (const { h, el } of tags) {
      projected.copy(onOrbit(h, RING_R + 0.28));
      orbit.localToWorld(projected).project(camera);
      el.style.left = `${((projected.x + 1) / 2) * 100}%`;
      el.style.top = `${((1 - projected.y) / 2) * 100}%`;
    }
  };

  // --- Interaction ----------------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const orbitPlane = new THREE.Plane();
  const hit = new THREE.Vector3();
  const lean = new THREE.Vector2(); // camera parallax target, -1..1
  let dragging = false;

  const toPointer = (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  };
  // The hour under the pointer, where its ray meets the orbit's plane. null if it misses.
  const hourUnderPointer = () => {
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(orbit.quaternion);
    orbitPlane.setFromNormalAndCoplanarPoint(normal, orbit.position);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(orbitPlane, hit)) return null;
    const local = orbit.worldToLocal(hit.clone());
    return { hour: (((Math.atan2(-local.x, local.z) / TAU) * 24) % 24 + 24) % 24, radius: Math.hypot(local.x, local.z) };
  };
  const onPlaneOrRing = () => {
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.intersectObject(grab, false).length) return true;
    const h = hourUnderPointer();
    return h && Math.abs(h.radius - RING_R) < 0.18;
  };

  canvas.addEventListener("pointerdown", (e) => {
    toPointer(e);
    if (!onPlaneOrRing()) return;
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    root.classList.add("is-dragging");
    const h = hourUnderPointer();
    if (h) flight.scrubTo(h.hour);
  });
  canvas.addEventListener("pointermove", (e) => {
    toPointer(e);
    lean.copy(pointer);
    if (dragging) {
      const h = hourUnderPointer();
      if (h) flight.scrubTo(h.hour);
    } else {
      canvas.style.cursor = onPlaneOrRing() ? "grab" : "default";
    }
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove("is-dragging");
    flight.release();
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", () => !dragging && lean.set(0, 0));

  // --- Render loop ----------------------------------------------------------------------------
  const resize = () => {
    const size = root.clientWidth;
    if (!size) return;
    renderer.setSize(size, size, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(root);
  resize();

  const t0 = performance.now();
  const render = () => {
    const t = (performance.now() - t0) / 1000;
    placePlane(flight.hour());

    if (!reduced) {
      // Kampala pulse: grow and fade every two seconds.
      const p = (t % 2) / 2;
      pulse.scale.setScalar(1 + p * 2.2);
      pulse.material.opacity = 0.85 * (1 - p);
      // The camera leans towards the pointer, more while dragging.
      const k = dragging ? 0.55 : 0.22;
      camera.position.x += (CAMERA_HOME.x + lean.x * k - camera.position.x) * 0.06;
      camera.position.y += (CAMERA_HOME.y + lean.y * k - camera.position.y) * 0.06;
      camera.lookAt(0, 0, 0);
    }
    placeTags();
    renderer.render(scene, camera);
  };

  root.prepend(canvas);
  render();
  root.classList.add("has-3d");
  root.querySelector("[data-legend]").hidden = false;

  if (reduced) {
    setInterval(render, 1000);
    return;
  }
  let frameId = 0;
  const loop = () => {
    render();
    frameId = requestAnimationFrame(loop);
  };
  // Only animate while the globe is on screen.
  new IntersectionObserver(([entry]) => {
    cancelAnimationFrame(frameId);
    frameId = entry.isIntersecting ? requestAnimationFrame(loop) : 0;
  }).observe(root);
}
