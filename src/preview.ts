import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { Triangle } from './extrude'

export function createPreview(container: HTMLElement): {
  setMeshes(black: Triangle[], white: Triangle[]): void
  setVisible(which: 'black' | 'white', visible: boolean): void
  dispose(): void
} {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xd8d8d8)

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000)
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  scene.add(new THREE.AmbientLight(0xffffff, 0.55))
  const key = new THREE.DirectionalLight(0xffffff, 0.95)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xffffff, 0.28)
  scene.add(fill)

  let blackMesh: THREE.Mesh | null = null
  let whiteMesh: THREE.Mesh | null = null
  let raf = 0

  function resize() {
    const w = container.clientWidth || 480
    const h = container.clientHeight || 360
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }

  function geometryFrom(tris: Triangle[]): THREE.BufferGeometry {
    const positions = new Float32Array(tris.length * 9)
    const normals = new Float32Array(tris.length * 9)
    for (let i = 0; i < tris.length; i++) {
      const t = tris[i]
      const o = i * 9
      positions.set([...t.a, ...t.b, ...t.c], o)
      normals.set([...t.n, ...t.n, ...t.n], o)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    return g
  }

  function setMeshes(black: Triangle[], white: Triangle[]) {
    if (blackMesh) scene.remove(blackMesh)
    if (whiteMesh) scene.remove(whiteMesh)
    blackMesh = new THREE.Mesh(
      geometryFrom(black),
      new THREE.MeshLambertMaterial({ color: 0x111111, side: THREE.DoubleSide }),
    )
    whiteMesh = new THREE.Mesh(
      geometryFrom(white),
      new THREE.MeshLambertMaterial({ color: 0xf4f4f4, side: THREE.DoubleSide }),
    )
    scene.add(blackMesh)
    scene.add(whiteMesh)
    const box = new THREE.Box3().setFromObject(blackMesh).union(new THREE.Box3().setFromObject(whiteMesh))
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const qrZ = box.min.z
    const span = Math.max(size.x, size.y, size.z, 1)
    const target = new THREE.Vector3(center.x, center.y, qrZ)
    // Print mesh stays face-down. View the QR from -Z so row 0 is at the top.
    camera.up.set(0, -1, 0)
    camera.position.set(center.x, center.y, qrZ - span * 1.35)
    camera.lookAt(target)
    controls.target.copy(target)
    key.position.set(center.x + span * 0.35, center.y - span * 0.3, qrZ - span)
    fill.position.set(center.x - span * 0.45, center.y + span * 0.4, qrZ - span * 0.35)
    controls.update()
  }

  function setVisible(which: 'black' | 'white', visible: boolean) {
    if (which === 'black' && blackMesh) blackMesh.visible = visible
    if (which === 'white' && whiteMesh) whiteMesh.visible = visible
  }

  function tick() {
    raf = requestAnimationFrame(tick)
    controls.update()
    renderer.render(scene, camera)
  }

  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()
  tick()

  return {
    setMeshes,
    setVisible,
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
