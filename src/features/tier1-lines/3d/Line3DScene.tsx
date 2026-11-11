/**
 * @file Line3DScene.tsx
 * @description WebGL Three.js Interactive Digital Twin Scene cho Line 1 (LN-PRS-01).
 * - Dựng 6 thiết bị 3D cơ khí chi tiết cao (Procedural CAD Industrial Look)
 * - Quản lý camera OrbitControls (xoay, zoom, pan, khóa góc không xuyên sàn)
 * - Tương tác Raycasting: Hover làm nổi bật máy, Click chọn đúng Machine ID
 * - Chiếu tọa độ 3D -> 2D (camera.project) để gắn nhãn dạng Pill thanh mảnh, không che máy
 * - Tự động cập nhật màu trạng thái Andon Light theo thời gian thực (Single Source of Truth)
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  LINE1_STATIONS_3D,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
} from './line3DLayout';
import { createMachine3D, Machine3DObject } from './machine3DModels';
import { createProductionEnvironment } from './ProductionFlow3D';
import { Eye } from 'lucide-react';

interface StationFlowData {
  id: string;
  code: string;
  name: string;
  actualCode: string;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'STOPPED' | 'OFFLINE';
  statusLabel: string;
  machine?: any;
  resolved?: any;
}

interface Line3DSceneProps {
  flowStations: StationFlowData[];
  onSelectMachine: (machineId: string) => void;
  isDarkMode?: boolean;
  onResetCameraRef?: (resetFn: () => void) => void;
}

interface ProjectedBadge {
  opCode: string;
  machineId: string;
  machineCode: string;
  name: string;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'STOPPED' | 'OFFLINE';
  statusLabel: string;
  screenX: number;
  screenY: number;
  visible: boolean;
}

export function Line3DScene({
  flowStations,
  onSelectMachine,
  isDarkMode = false,
  onResetCameraRef,
}: Line3DSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const machineObjectsRef = useRef<Map<string, Machine3DObject>>(new Map());
  const animFrameIdRef = useRef<number | null>(null);

  // Vị trí chuột để phân biệt Click và Drag Orbit
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Floating labels được chiếu lên màn hình dạng Pill
  const [projectedBadges, setProjectedBadges] = useState<ProjectedBadge[]>([]);
  const [hoveredStation, setHoveredStation] = useState<StationFlowData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Ánh xạ nhanh flowStation theo index hoặc code
  const stationDataMap = useMemo(() => {
    const map = new Map<string, StationFlowData>();
    flowStations.forEach((st, idx) => {
      map.set(`OP${(idx + 1) * 10}`, st);
      map.set(st.code, st);
      if (st.id) map.set(st.id, st);
    });
    return map;
  }, [flowStations]);

  // Hàm Reset camera về góc nhìn toàn cảnh mặc định
  const resetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    camera.position.set(
      DEFAULT_CAMERA_POSITION.x,
      DEFAULT_CAMERA_POSITION.y,
      DEFAULT_CAMERA_POSITION.z
    );
    controls.target.set(
      DEFAULT_CAMERA_TARGET.x,
      DEFAULT_CAMERA_TARGET.y,
      DEFAULT_CAMERA_TARGET.z
    );
    controls.update();
  }, []);

  useEffect(() => {
    if (onResetCameraRef) {
      onResetCameraRef(resetCamera);
    }
  }, [onResetCameraRef, resetCamera]);

  // Khởi tạo Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;

    // 1. Scene & Sương mù công nghiệp (Fog)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkMode ? 0x090d16 : 0xf8fafc);
    scene.fog = new THREE.FogExp2(isDarkMode ? 0x090d16 : 0xf8fafc, 0.012);
    sceneRef.current = scene;

    // 2. Camera Isometric 3/4 ôm trọn 6 máy
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 200);
    camera.position.set(
      DEFAULT_CAMERA_POSITION.x,
      DEFAULT_CAMERA_POSITION.y,
      DEFAULT_CAMERA_POSITION.z
    );
    cameraRef.current = camera;

    // 3. Renderer với khử răng cưa và Soft Shadows
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls tinh chỉnh
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 5;
    controls.maxDistance = 35;
    controls.maxPolarAngle = Math.PI / 2 - 0.08; // Không xuyên sàn
    controls.target.set(
      DEFAULT_CAMERA_TARGET.x,
      DEFAULT_CAMERA_TARGET.y,
      DEFAULT_CAMERA_TARGET.z
    );
    controls.update();
    controlsRef.current = controls;

    // 5. Hệ thống chiếu sáng 3 điểm chuyên nghiệp
    const ambientLight = new THREE.AmbientLight(
      isDarkMode ? 0x94a3b8 : 0xffffff,
      isDarkMode ? 0.7 : 0.9
    );
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(
      isDarkMode ? 0x38bdf8 : 0xffffff,
      isDarkMode ? 0x1e293b : 0xe2e8f0,
      isDarkMode ? 0.45 : 0.55
    );
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, isDarkMode ? 1.2 : 1.45);
    sunLight.position.set(16, 24, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 65;
    sunLight.shadow.camera.left = -18;
    sunLight.shadow.camera.right = 18;
    sunLight.shadow.camera.top = 15;
    sunLight.shadow.camera.bottom = -15;
    sunLight.shadow.bias = -0.0003;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, isDarkMode ? 0.45 : 0.35);
    fillLight.position.set(-15, 12, -10);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, isDarkMode ? 0.35 : 0.25);
    rimLight.position.set(0, 8, -18);
    scene.add(rimLight);

    // 6. Production Environment (Sàn Epoxy vát cạnh, Băng tải con lăn thép đôi, Vạch 5S)
    const env = createProductionEnvironment(isDarkMode);
    scene.add(env.group);

    // 7. Tạo 6 đối tượng máy cơ khí chi tiết cao độc lập
    const machineObjects = new Map<string, Machine3DObject>();

    LINE1_STATIONS_3D.forEach((cfg) => {
      const liveData = stationDataMap.get(cfg.opCode);
      const machineId = liveData?.machine ? liveData.machine.id : (liveData?.id || cfg.defaultDbId);
      const machineCode = liveData?.machine?.code || liveData?.actualCode || cfg.defaultMachineCode;

      const machineObj = createMachine3D(cfg.modelType, machineId, machineCode);
      machineObj.position.set(cfg.posX, cfg.posY, cfg.posZ);
      machineObj.rotation.y = cfg.rotationY;
      machineObj.scale.setScalar(cfg.scale);

      // Cập nhật trạng thái khởi tạo
      if (liveData?.status) {
        machineObj.updateStatus(liveData.status);
      }

      scene.add(machineObj);
      machineObjects.set(cfg.opCode, machineObj);
    });

    machineObjectsRef.current = machineObjects;

    // Raycaster để phát hiện tương tác chuột
    const raycaster = new THREE.Raycaster();
    const mousePos = new THREE.Vector2();

    // 8. TÍNH TOÁN TỌA ĐỘ CHIẾU BADGE (Projection Loop dạng Pill trên đỉnh Andon)
    const updateProjectedBadges = () => {
      if (!cameraRef.current || !container) return;
      const cam = cameraRef.current;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const newBadges: ProjectedBadge[] = [];

      LINE1_STATIONS_3D.forEach((cfg) => {
        const liveData = stationDataMap.get(cfg.opCode);
        const machineObj = machineObjects.get(cfg.opCode);
        if (!machineObj) return;

        // Vị trí đỉnh máy phía trên tháp Andon để treo Pill nhãn mà không che kết cấu cơ khí
        const yOffset = cfg.modelType === 'heavy_press' ? 4.5 : cfg.modelType === 'test_chamber' ? 3.9 : 3.7;
        const topPos = new THREE.Vector3(cfg.posX, cfg.posY + yOffset * cfg.scale, cfg.posZ);
        topPos.project(cam);

        // Nằm phía trước camera (z < 1)
        const isVisible = topPos.z < 1;
        const screenX = ((topPos.x + 1) * rect.width) / 2;
        const screenY = ((-topPos.y + 1) * rect.height) / 2;

        newBadges.push({
          opCode: cfg.opCode,
          machineId: liveData?.machine ? liveData.machine.id : (liveData?.id || cfg.defaultDbId),
          machineCode: liveData?.actualCode || cfg.defaultMachineCode,
          name: liveData?.name || cfg.name,
          status: liveData?.status || 'OK',
          statusLabel: liveData?.statusLabel || 'Đang chạy',
          screenX,
          screenY,
          visible: isVisible,
        });
      });

      setProjectedBadges(newBadges);
    };

    // 9. VÒNG LẶP RENDER (Animation Loop)
    let isRunning = true;
    const animate = (time: number) => {
      if (!isRunning) return;

      env.animate(time);
      controls.update();
      renderer.render(scene, camera);
      updateProjectedBadges();

      animFrameIdRef.current = requestAnimationFrame(animate);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // 10. XỬ LÝ RESIZE
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 11. XỬ LÝ SỰ KIỆN CHUỘT (Raycasting)
    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mousePos, camera);

      // Thu thập toàn bộ mesh của các máy
      const allMeshes: THREE.Object3D[] = [];
      machineObjects.forEach((mObj) => {
        mObj.traverse((child) => {
          if (child instanceof THREE.Mesh) allMeshes.push(child);
        });
      });

      const intersects = raycaster.intersectObjects(allMeshes, false);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const parentGroup = hit.userData.parentGroup as Machine3DObject;
        if (parentGroup && parentGroup.userData) {
          container.style.cursor = 'pointer';
          const opCode = parentGroup.userData.stationCode;
          const liveData = stationDataMap.get(opCode) || null;
          setHoveredStation(liveData);
          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          parentGroup.setStatusGlow(true);
          return;
        }
      }

      // Không trúng máy nào
      container.style.cursor = 'default';
      setHoveredStation(null);
      setTooltipPos(null);
      machineObjects.forEach((mObj) => mObj.setStatusGlow(false));
    };

    const onPointerDown = (e: MouseEvent) => {
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: MouseEvent) => {
      // Nếu rê chuột xoay camera (> 6px), không coi là click chọn máy
      const dx = Math.abs(e.clientX - pointerStartRef.current.x);
      const dy = Math.abs(e.clientY - pointerStartRef.current.y);
      if (dx > 6 || dy > 6) return;

      const rect = container.getBoundingClientRect();
      mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mousePos, camera);

      const allMeshes: THREE.Object3D[] = [];
      machineObjects.forEach((mObj) => {
        mObj.traverse((child) => {
          if (child instanceof THREE.Mesh) allMeshes.push(child);
        });
      });

      const intersects = raycaster.intersectObjects(allMeshes, false);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const parentGroup = hit.userData.parentGroup as Machine3DObject;
        if (parentGroup && parentGroup.userData?.machineId) {
          onSelectMachine(parentGroup.userData.machineId);
        }
      }
    };

    container.addEventListener('mousemove', onPointerMove);
    container.addEventListener('mousedown', onPointerDown);
    container.addEventListener('mouseup', onPointerUp);

    // CLEANUP
    return () => {
      isRunning = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();

      container.removeEventListener('mousemove', onPointerMove);
      container.removeEventListener('mousedown', onPointerDown);
      container.removeEventListener('mouseup', onPointerUp);

      env.dispose();
      controls.dispose();
      renderer.dispose();

      machineObjects.forEach((mObj) => {
        mObj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else if (child.material) {
              child.material.dispose();
            }
          }
        });
      });
    };
  }, [isDarkMode, stationDataMap, onSelectMachine]);

  // ĐỒNG BỘ TRẠNG THÁI VẬN HÀNH THỜI GIAN THỰC (Phản ứng tức thì khi Store cập nhật)
  useEffect(() => {
    const machineObjects = machineObjectsRef.current;
    if (!machineObjects || machineObjects.size === 0) return;

    LINE1_STATIONS_3D.forEach((cfg) => {
      const liveData = stationDataMap.get(cfg.opCode);
      const machineObj = machineObjects.get(cfg.opCode);
      if (machineObj && liveData) {
        machineObj.updateStatus(liveData.status);
      }
    });
  }, [stationDataMap]);

  return (
    <div className="relative w-full h-[470px] sm:h-[500px] lg:h-[530px] select-none rounded-xl overflow-hidden border border-slate-200/90 dark:border-factory-border bg-slate-50 dark:bg-slate-950">
      {/* 1. Canvas Three.js WebGL Mount Point */}
      <div ref={mountRef} className="w-full h-full" />

      {/* 2. Thẻ lơ lửng thông tin từng trạm dạng Pill nhỏ gọn (Compact Floating Pills) */}
      <div className="absolute inset-0 pointer-events-none">
        {projectedBadges.map((badge) => {
          if (!badge.visible) return null;

          const isCritical = badge.status === 'CRITICAL';
          const isWarning = badge.status === 'WARNING';
          const isStopped = badge.status === 'STOPPED' || badge.status === 'OFFLINE';

          const dotColorClass = isCritical
            ? 'bg-rose-500 ring-4 ring-rose-500/40 animate-ping'
            : isWarning
            ? 'bg-amber-400 ring-2 ring-amber-400/50 animate-pulse'
            : isStopped
            ? 'bg-slate-400 ring-1 ring-slate-400/40'
            : 'bg-emerald-400 ring-2 ring-emerald-400/40';

          const pillBorderClass = isCritical
            ? 'border-rose-500/80 bg-slate-950/90 text-rose-200 ring-1 ring-rose-500/40'
            : isWarning
            ? 'border-amber-500/80 bg-slate-950/90 text-amber-200 ring-1 ring-amber-500/30'
            : isStopped
            ? 'border-slate-700 bg-slate-950/85 text-slate-300'
            : 'border-slate-700/80 hover:border-emerald-500/80 bg-slate-950/85 text-slate-200';

          return (
            <div
              key={badge.opCode}
              style={{
                position: 'absolute',
                left: `${badge.screenX}px`,
                top: `${badge.screenY}px`,
                transform: 'translate(-50%, -100%)',
              }}
              className="pointer-events-auto transition-transform hover:scale-105"
            >
              <button
                type="button"
                onClick={() => onSelectMachine(badge.machineId)}
                onMouseEnter={(e) => {
                  const rect = mountRef.current?.getBoundingClientRect();
                  if (rect) {
                    setHoveredStation(stationDataMap.get(badge.opCode) || null);
                    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredStation(null);
                  setTooltipPos(null);
                }}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-full border shadow-lg backdrop-blur-md transition-all cursor-pointer ${pillBorderClass}`}
                title={`Nhấn để mở Machine Detail & CHECK SHEET cho máy ${badge.machineCode} (${badge.name})`}
              >
                {/* Chấm tròn trạng thái */}
                <span className="relative flex h-2 w-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${dotColorClass}`} />
                </span>

                {/* Mã OP & Mã máy */}
                <div className="flex items-center gap-1 font-mono text-[11px] font-bold leading-none">
                  <span className="text-white/90">[{badge.opCode}]</span>
                  <span className="text-slate-300 font-semibold">{badge.machineCode}</span>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* 3. Tooltip khi di chuột qua Pill hoặc mô hình máy (Rich Hover Card) */}
      {hoveredStation && tooltipPos && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(tooltipPos.x + 12, (mountRef.current?.clientWidth || 700) - 260)}px`,
            top: `${Math.max(tooltipPos.y - 10, 10)}px`,
          }}
          className="pointer-events-none z-30 p-3 rounded-xl bg-slate-900/95 border border-slate-700/80 text-white shadow-2xl backdrop-blur-md w-60 transition-opacity"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
            <span className="font-mono text-xs font-black text-blue-400">
              {hoveredStation.code} • {hoveredStation.actualCode}
            </span>
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                hoveredStation.status === 'CRITICAL'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : hoveredStation.status === 'WARNING'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : hoveredStation.status === 'STOPPED' || hoveredStation.status === 'OFFLINE'
                  ? 'bg-slate-700 text-slate-300'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {hoveredStation.statusLabel}
            </span>
          </div>

          <p className="text-xs font-semibold text-slate-100 line-clamp-1">{hoveredStation.name}</p>

          <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span className="flex items-center gap-1 text-blue-400">
              <Eye className="w-3 h-3" />
              <span>Xem chi tiết máy</span>
            </span>
            <span className="font-mono text-slate-500">Click to open</span>
          </div>
        </div>
      )}

      {/* 4. Thanh hướng dẫn thao tác 3D (Navigation Hint) */}
      <div className="absolute bottom-2.5 left-3 pointer-events-none flex items-center gap-2 text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <span>🖱️ Chuột trái: Xoay</span>
        <span>•</span>
        <span>Cuộn: Zoom</span>
        <span>•</span>
        <span>Chuột phải: Di chuyển</span>
      </div>

      {/* 5. Ghi chú tính chất mô hình */}
      <div className="absolute bottom-2.5 right-3 pointer-events-none text-[9px] font-mono text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-200/70 dark:border-slate-800 shadow-2xs">
        DENSO Line 1 Digital Twin • Procedural 3D
      </div>
    </div>
  );
}
