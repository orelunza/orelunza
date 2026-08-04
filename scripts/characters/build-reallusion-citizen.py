#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
import os
import sys
from pathlib import Path
from typing import Iterable

import bpy
from mathutils import Matrix, Quaternion, Vector


TARGET_HEIGHT = 1.78
ROOT_YAW_DEGREES = 180.0
REQUIRED_CLIPS = (
    "idle",
    "walk",
    "run",
    "strafe_left",
    "strafe_right",
    "walk_backward",
    "jump",
    "fall",
    "land",
)

BONE_MAP = {
    "CC_Base_Hip": "mixamorigHips",
    "CC_Base_Waist": "mixamorigSpine",
    "CC_Base_Spine01": "mixamorigSpine1",
    "CC_Base_Spine02": "mixamorigSpine2",
    "CC_Base_NeckTwist01": "mixamorigNeck",
    "CC_Base_Head": "mixamorigHead",
    "CC_Base_L_Clavicle": "mixamorigLeftShoulder",
    "CC_Base_L_Upperarm": "mixamorigLeftArm",
    "CC_Base_L_Forearm": "mixamorigLeftForeArm",
    "CC_Base_L_Hand": "mixamorigLeftHand",
    "CC_Base_R_Clavicle": "mixamorigRightShoulder",
    "CC_Base_R_Upperarm": "mixamorigRightArm",
    "CC_Base_R_Forearm": "mixamorigRightForeArm",
    "CC_Base_R_Hand": "mixamorigRightHand",
    "CC_Base_L_Thigh": "mixamorigLeftUpLeg",
    "CC_Base_L_Calf": "mixamorigLeftLeg",
    "CC_Base_L_Foot": "mixamorigLeftFoot",
    "CC_Base_L_ToeBase": "mixamorigLeftToeBase",
    "CC_Base_R_Thigh": "mixamorigRightUpLeg",
    "CC_Base_R_Calf": "mixamorigRightLeg",
    "CC_Base_R_Foot": "mixamorigRightFoot",
    "CC_Base_R_ToeBase": "mixamorigRightToeBase",
}


def log(message: str) -> None:
    print(f"[orelunza-character] {message}", flush=True)


def fail(message: str) -> "NoReturn":
    raise RuntimeError(message)


def parse_args() -> argparse.Namespace:
    script_path = Path(__file__).resolve()
    project_root = script_path.parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", type=Path, default=project_root)
    parser.add_argument(
        "--model",
        type=Path,
        default=Path.home()
        / "Downloads"
        / "CC_character_base"
        / "CC Character Base"
        / "FBX"
        / "03_Neutral_M"
        / "Neutral_M.Fbx",
    )
    parser.add_argument("--height", type=float, default=TARGET_HEIGHT)
    parser.add_argument("--yaw-degrees", type=float, default=ROOT_YAW_DEGREES)
    parser.add_argument("--skip-renders", action="store_true")
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def animation_sources(project_root: Path) -> dict[str, Path]:
    base = (
        project_root
        / "frontend"
        / "static"
        / "assets"
        / "characters"
        / "orelunza-citizen"
        / "mixamo"
    )
    return {
        "idle": base / "base-idle.fbx",
        "walk": base / "walk.fbx",
        "run": base / "run.fbx",
        "strafe_left": base / "strafe-left.fbx",
        "strafe_right": base / "strafe-right.fbx",
        "walk_backward": base / "walk-backward.fbx",
        "jump": base / "jump.fbx",
        "fall": base / "fall.fbx",
        "land": base / "land.fbx",
    }


def ensure_sources(model_path: Path, clips: dict[str, Path]) -> None:
    missing = [model_path] if not model_path.is_file() else []
    missing.extend(path for path in clips.values() if not path.is_file())
    if missing:
        fail("Missing source files:\n" + "\n".join(f"  - {path}" for path in missing))


def clear_scene() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.actions,
        bpy.data.armatures,
        bpy.data.cameras,
        bpy.data.curves,
        bpy.data.lights,
        bpy.data.meshes,
    ):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def import_fbx(path: Path) -> list[bpy.types.Object]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(
        filepath=str(path),
        use_anim=True,
        automatic_bone_orientation=False,
        use_prepost_rot=True,
        bake_space_transform=False,
    )
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if not imported:
        fail(f"FBX import produced no objects: {path}")
    return imported


def armature_score(armature: bpy.types.Object) -> tuple[int, int]:
    skinned = sum(
        1
        for obj in bpy.data.objects
        if obj.type == "MESH"
        and any(
            modifier.type == "ARMATURE" and modifier.object == armature
            for modifier in obj.modifiers
        )
    )
    return skinned, len(armature.data.bones)


def find_armature(objects: Iterable[bpy.types.Object]) -> bpy.types.Object:
    armatures = [obj for obj in objects if obj.type == "ARMATURE"]
    if not armatures:
        fail("No armature found in imported FBX.")
    return max(armatures, key=armature_score)


def find_skinned_meshes(
    objects: Iterable[bpy.types.Object], armature: bpy.types.Object
) -> list[bpy.types.Object]:
    meshes: list[bpy.types.Object] = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        uses_armature = obj.parent == armature or any(
            modifier.type == "ARMATURE" and modifier.object == armature
            for modifier in obj.modifiers
        )
        if uses_armature:
            meshes.append(obj)
    return meshes


def create_avatar_root(imported: list[bpy.types.Object]) -> bpy.types.Object:
    root = bpy.data.objects.new("OrelunzaCitizen", None)
    root.empty_display_type = "PLAIN_AXES"
    bpy.context.scene.collection.objects.link(root)
    imported_set = set(imported)

    for obj in imported:
        if obj.parent not in imported_set:
            world_matrix = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = world_matrix

    return root


def hierarchy(root: bpy.types.Object) -> list[bpy.types.Object]:
    result = [root]
    for child in root.children:
        result.extend(hierarchy(child))
    return result


def object_world_bbox(objects: Iterable[bpy.types.Object]) -> tuple[Vector, Vector]:
    minimum = Vector((math.inf, math.inf, math.inf))
    maximum = Vector((-math.inf, -math.inf, -math.inf))
    found = False
    depsgraph = bpy.context.evaluated_depsgraph_get()

    for obj in objects:
        if obj.type != "MESH" or not obj.visible_get():
            continue
        evaluated = obj.evaluated_get(depsgraph)
        for corner in evaluated.bound_box:
            point = evaluated.matrix_world @ Vector(corner)
            minimum.x = min(minimum.x, point.x)
            minimum.y = min(minimum.y, point.y)
            minimum.z = min(minimum.z, point.z)
            maximum.x = max(maximum.x, point.x)
            maximum.y = max(maximum.y, point.y)
            maximum.z = max(maximum.z, point.z)
            found = True

    if not found:
        fail("Unable to calculate a mesh bounding box.")
    return minimum, maximum


def normalize_avatar_root(root: bpy.types.Object, target_height: float, yaw_degrees: float) -> None:
    root.rotation_euler = (0.0, 0.0, math.radians(yaw_degrees))
    bpy.context.view_layer.update()
    minimum, maximum = object_world_bbox(hierarchy(root))
    height = maximum.z - minimum.z
    if not math.isfinite(height) or height <= 0:
        fail(f"Invalid imported model height: {height}")

    scale = target_height / height
    root.scale = (scale, scale, scale)
    bpy.context.view_layer.update()

    minimum, maximum = object_world_bbox(hierarchy(root))
    center = (minimum + maximum) * 0.5
    root.location.x -= center.x
    root.location.y -= center.y
    root.location.z -= minimum.z
    bpy.context.view_layer.update()

    minimum, maximum = object_world_bbox(hierarchy(root))
    normalized_height = maximum.z - minimum.z
    log(
        "Normalized model bounds: "
        f"min={tuple(round(value, 4) for value in minimum)}, "
        f"max={tuple(round(value, 4) for value in maximum)}, "
        f"height={normalized_height:.4f}"
    )


def normalize_bone_name(name: str) -> str:
    normalized = name.replace("\\", "/").split("/")[-1].split(":")[-1]
    for prefix in ("mixamorig", "cc_base_", "ccbase", "beta_joints"):
        if normalized.lower().startswith(prefix):
            normalized = normalized[len(prefix) :]
            break
    return "".join(character for character in normalized.lower() if character.isalnum())


def resolve_bone(armature: bpy.types.Object, expected: str) -> str | None:
    if expected in armature.data.bones:
        return expected

    expected_normalized = normalize_bone_name(expected)
    exact = [
        bone.name
        for bone in armature.data.bones
        if normalize_bone_name(bone.name) == expected_normalized
    ]
    if exact:
        return exact[0]

    suffix = [
        bone.name
        for bone in armature.data.bones
        if normalize_bone_name(bone.name).endswith(expected_normalized)
        or expected_normalized.endswith(normalize_bone_name(bone.name))
    ]
    return suffix[0] if len(suffix) == 1 else None


def resolved_mapping(
    target_armature: bpy.types.Object, source_armature: bpy.types.Object
) -> list[tuple[str, str]]:
    mapping: list[tuple[str, str]] = []
    missing: list[str] = []

    for target_expected, source_expected in BONE_MAP.items():
        target = resolve_bone(target_armature, target_expected)
        source = resolve_bone(source_armature, source_expected)
        if target and source:
            mapping.append((target, source))
        else:
            missing.append(
                f"{target_expected if not target else target} <- "
                f"{source_expected if not source else source}"
            )

    essential_targets = {
        "CC_Base_Hip",
        "CC_Base_Spine01",
        "CC_Base_Head",
        "CC_Base_L_Upperarm",
        "CC_Base_R_Upperarm",
        "CC_Base_L_Thigh",
        "CC_Base_R_Thigh",
        "CC_Base_L_Foot",
        "CC_Base_R_Foot",
    }
    unresolved_essential = [
        item
        for item in missing
        if any(name in item for name in essential_targets)
    ]
    if unresolved_essential:
        fail(
            "Essential retarget bones are missing:\n"
            + "\n".join(f"  - {item}" for item in unresolved_essential)
        )

    if missing:
        log("Optional unmapped bones: " + ", ".join(missing))
    log(f"Resolved {len(mapping)} bone pairs.")
    return mapping


def armature_rest_height(armature: bpy.types.Object) -> float:
    values: list[float] = []
    for bone in armature.data.bones:
        values.append((armature.matrix_world @ bone.head_local).z)
        values.append((armature.matrix_world @ bone.tail_local).z)
    return max(values) - min(values) if values else 1.0


def bone_depth(armature: bpy.types.Object, bone_name: str) -> int:
    depth = 0
    bone = armature.data.bones[bone_name]
    while bone.parent:
        depth += 1
        bone = bone.parent
    return depth


def find_source_action(
    source_armature: bpy.types.Object, imported_actions: set[bpy.types.Action]
) -> bpy.types.Action:
    if source_armature.animation_data and source_armature.animation_data.action:
        return source_armature.animation_data.action

    candidates = [
        action
        for action in imported_actions
        if action.frame_range[1] - action.frame_range[0] > 0
    ]
    if not candidates:
        fail(f"No animation action found on source armature {source_armature.name}.")
    return max(candidates, key=lambda action: action.frame_range[1] - action.frame_range[0])


def rest_local_matrix(armature: bpy.types.Object, bone_name: str) -> Matrix:
    bone = armature.data.bones[bone_name]
    if bone.parent:
        return bone.parent.matrix_local.inverted_safe() @ bone.matrix_local
    return bone.matrix_local.copy()


def pose_local_matrix(armature: bpy.types.Object, bone_name: str) -> Matrix:
    pose_bone = armature.pose.bones[bone_name]
    if pose_bone.parent:
        return pose_bone.parent.matrix.inverted_safe() @ pose_bone.matrix
    return pose_bone.matrix.copy()


def matrix_from_translation_rotation(translation: Vector, rotation: Quaternion) -> Matrix:
    return Matrix.Translation(translation) @ rotation.normalized().to_matrix().to_4x4()


def reset_target_pose(target_armature: bpy.types.Object) -> None:
    for pose_bone in target_armature.pose.bones:
        pose_bone.rotation_mode = "QUATERNION"
        pose_bone.location = (0.0, 0.0, 0.0)
        pose_bone.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
        pose_bone.scale = (1.0, 1.0, 1.0)
        pose_bone.matrix_basis.identity()


def bake_clip(
    clip_name: str,
    source_path: Path,
    target_armature: bpy.types.Object,
) -> bpy.types.Action:
    log(f"Importing and baking {clip_name}: {source_path.name}")
    objects_before = set(bpy.data.objects)
    actions_before = set(bpy.data.actions)
    imported = import_fbx(source_path)
    source_armature = find_armature(imported)
    imported_actions = set(bpy.data.actions) - actions_before
    source_action = find_source_action(source_armature, imported_actions)
    mapping = resolved_mapping(target_armature, source_armature)
    mapping.sort(key=lambda pair: bone_depth(target_armature, pair[0]))

    source_armature.animation_data_create()
    source_armature.animation_data.action = source_action
    target_armature.animation_data_create()
    target_action = bpy.data.actions.new(clip_name)
    target_action.use_fake_user = True
    target_armature.animation_data.action = target_action

    source_height = max(armature_rest_height(source_armature), 0.0001)
    target_height = max(armature_rest_height(target_armature), 0.0001)
    translation_scale = target_height / source_height
    start = int(math.floor(source_action.frame_range[0]))
    end = int(math.ceil(source_action.frame_range[1]))
    if end <= start:
        fail(f"Animation {clip_name} has an invalid frame range: {source_action.frame_range}")

    scene = bpy.context.scene
    scene.frame_start = 0
    scene.frame_end = max(scene.frame_end, end - start)
    target_hip = resolve_bone(target_armature, "CC_Base_Hip")
    source_hip = resolve_bone(source_armature, "mixamorigHips")

    for source_frame in range(start, end + 1):
        destination_frame = source_frame - start
        scene.frame_set(source_frame)
        bpy.context.view_layer.update()
        reset_target_pose(target_armature)
        bpy.context.view_layer.update()

        desired_global: dict[str, Matrix] = {}

        for target_name, source_name in mapping:
            target_bone = target_armature.data.bones[target_name]
            target_rest_local = rest_local_matrix(target_armature, target_name)
            source_rest_local = rest_local_matrix(source_armature, source_name)
            source_pose_local = pose_local_matrix(source_armature, source_name)

            alignment = (
                target_rest_local.to_quaternion()
                @ source_rest_local.to_quaternion().inverted()
            )
            desired_rotation = alignment @ source_pose_local.to_quaternion()
            desired_translation = target_rest_local.to_translation()

            if target_name == target_hip and source_name == source_hip:
                vertical_delta = (
                    source_pose_local.to_translation()
                    - source_rest_local.to_translation()
                ).z
                desired_translation.z += vertical_delta * translation_scale

            desired_local = matrix_from_translation_rotation(
                desired_translation, desired_rotation
            )
            if target_bone.parent:
                parent_matrix = desired_global.get(
                    target_bone.parent.name,
                    target_armature.pose.bones[target_bone.parent.name].matrix.copy(),
                )
                desired_matrix = parent_matrix @ desired_local
            else:
                desired_matrix = desired_local

            target_pose_bone = target_armature.pose.bones[target_name]
            target_pose_bone.matrix = desired_matrix
            desired_global[target_name] = desired_matrix.copy()
            bpy.context.view_layer.update()

        for target_name, _ in mapping:
            pose_bone = target_armature.pose.bones[target_name]
            pose_bone.keyframe_insert(
                data_path="location",
                frame=destination_frame,
                group=target_name,
            )
            pose_bone.keyframe_insert(
                data_path="rotation_quaternion",
                frame=destination_frame,
                group=target_name,
            )
            pose_bone.keyframe_insert(
                data_path="scale",
                frame=destination_frame,
                group=target_name,
            )

    for fcurve in target_action.fcurves:
        for keyframe in fcurve.keyframe_points:
            keyframe.interpolation = "LINEAR"

    target_action["orelunza_clip"] = clip_name
    target_action["source_fbx"] = source_path.name

    target_armature.animation_data.action = None
    source_armature.animation_data.action = None
    scene.frame_set(0)
    delete_objects([obj for obj in bpy.data.objects if obj not in objects_before])

    for action in list(imported_actions):
        if action == target_action or action.name not in bpy.data.actions:
            continue

        action.use_fake_user = False

        for obj in bpy.data.objects:
            if obj.animation_data and obj.animation_data.action == action:
                obj.animation_data.action = None

        bpy.data.actions.remove(action, do_unlink=True)

    log(
        f"Baked {clip_name}: frames 0-{end - start}, "
        f"curves={len(target_action.fcurves)}"
    )
    return target_action


def delete_objects(objects: Iterable[bpy.types.Object]) -> None:
    for obj in list(objects):
        if obj.name not in bpy.data.objects:
            continue
        bpy.data.objects.remove(obj, do_unlink=True)


def action_target_bones(action: bpy.types.Action) -> set[str]:
    prefix = 'pose.bones["'
    targets: set[str] = set()

    for fcurve in action.fcurves:
        data_path = fcurve.data_path

        if not data_path.startswith(prefix):
            continue

        end = data_path.find('"]', len(prefix))

        if end > len(prefix):
            targets.add(data_path[len(prefix):end])

    return targets


def remove_non_target_actions(actions: dict[str, bpy.types.Action]) -> None:
    allowed_names = {action.name for action in actions.values()}

    for obj in bpy.data.objects:
        if (
            obj.animation_data
            and obj.animation_data.action
            and obj.animation_data.action.name not in allowed_names
        ):
            obj.animation_data.action = None

    for action in list(bpy.data.actions):
        if action.name in allowed_names:
            continue

        action.use_fake_user = False
        bpy.data.actions.remove(action, do_unlink=True)

    remaining = sorted(action.name for action in bpy.data.actions)
    expected = sorted(allowed_names)

    if remaining != expected:
        fail(
            'Unexpected actions before export: '
            f'expected={expected}, remaining={remaining}'
        )


def finite_action(action: bpy.types.Action) -> bool:
    return all(
        math.isfinite(point.co.x) and math.isfinite(point.co.y)
        for fcurve in action.fcurves
        for point in fcurve.keyframe_points
    )


def varying_curve_count(action: bpy.types.Action) -> int:
    count = 0
    for fcurve in action.fcurves:
        values = [point.co.y for point in fcurve.keyframe_points]
        if values and max(values) - min(values) > 1e-5:
            count += 1
    return count


def validate_asset(
    root: bpy.types.Object,
    armature: bpy.types.Object,
    meshes: list[bpy.types.Object],
    actions: dict[str, bpy.types.Action],
) -> None:
    if not meshes:
        fail("Target model contains no mesh bound to the Reallusion armature.")
    if not any(
        any(
            modifier.type == "ARMATURE" and modifier.object == armature
            for modifier in mesh.modifiers
        )
        or mesh.parent == armature
        for mesh in meshes
    ):
        fail("Target model contains no valid skinned mesh binding.")

    minimum, maximum = object_world_bbox(hierarchy(root))
    dimensions = maximum - minimum
    if not 1.7 <= dimensions.z <= 1.9:
        fail(f"Invalid exported character height: {dimensions.z:.4f}")
    if dimensions.x > 3.0 or dimensions.y > 3.0:
        fail(f"Character bounds are incoherent: {tuple(dimensions)}")
    if abs(minimum.z) > 0.03:
        fail(f"Character feet are not on the ground: min Z={minimum.z:.4f}")

    missing = [name for name in REQUIRED_CLIPS if name not in actions]
    if missing:
        fail("Missing baked actions: " + ", ".join(missing))

    target_bones = {bone.name for bone in armature.data.bones}

    for name, action in actions.items():
        if len(action.fcurves) == 0:
            fail(f"Action {name} has no animation curves.")
        if action.frame_range[1] - action.frame_range[0] < 1:
            fail(f"Action {name} has an invalid duration.")
        if not finite_action(action):
            fail(f"Action {name} contains NaN or infinite keyframes.")
        if varying_curve_count(action) < 3:
            fail(f"Action {name} appears static or T-pose-like.")

        missing_targets = sorted(action_target_bones(action) - target_bones)

        if missing_targets:
            fail(
                f"Action {name} targets bones absent from the Reallusion armature: "
                + ", ".join(missing_targets)
            )

    log(
        f"Validation passed: meshes={len(meshes)}, bones={len(armature.data.bones)}, "
        f"height={dimensions.z:.4f}, actions={len(actions)}"
    )


def look_at(camera: bpy.types.Object, target: Vector) -> None:
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_previews(
    root: bpy.types.Object,
    armature: bpy.types.Object,
    actions: dict[str, bpy.types.Action],
) -> None:
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.035, 0.045, 0.055)

    camera_data = bpy.data.cameras.new("OrelunzaPreviewCamera")
    camera = bpy.data.objects.new("OrelunzaPreviewCamera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (3.2, 4.6, 2.3)
    camera_data.lens = 58
    look_at(camera, Vector((0.0, 0.0, 0.95)))
    scene.camera = camera

    key = bpy.data.lights.new("OrelunzaKey", "AREA")
    key.energy = 900
    key.shape = "DISK"
    key.size = 4.0
    key_object = bpy.data.objects.new("OrelunzaKey", key)
    scene.collection.objects.link(key_object)
    key_object.location = (3.5, 2.5, 5.0)
    look_at(key_object, Vector((0.0, 0.0, 1.0)))

    fill = bpy.data.lights.new("OrelunzaFill", "AREA")
    fill.energy = 450
    fill.size = 3.0
    fill_object = bpy.data.objects.new("OrelunzaFill", fill)
    scene.collection.objects.link(fill_object)
    fill_object.location = (-3.0, 1.0, 2.8)
    look_at(fill_object, Vector((0.0, 0.0, 1.0)))

    previews = {
        "idle": Path("/tmp/orelunza-idle.png"),
        "walk": Path("/tmp/orelunza-walk.png"),
        "run": Path("/tmp/orelunza-run.png"),
        "strafe_left": Path("/tmp/orelunza-strafe.png"),
    }

    armature.animation_data_create()
    for clip_name, output in previews.items():
        action = actions[clip_name]
        armature.animation_data.action = action
        start, end = action.frame_range
        frame = int(round(start + (end - start) * 0.42))
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        if not output.is_file() or output.stat().st_size == 0:
            fail(f"Preview render was not created: {output}")
        log(f"Rendered {output}")

    armature.animation_data.action = actions["idle"]
    scene.frame_set(0)


def select_hierarchy(root: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in hierarchy(root):
        obj.hide_set(False)
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root


def export_glb(
    output: Path,
    root: bpy.types.Object,
    armature: bpy.types.Object,
    actions: dict[str, bpy.types.Action],
) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()

    remove_non_target_actions(actions)
    armature.animation_data_create()
    armature.animation_data.action = actions["idle"]

    for action in actions.values():
        action.use_fake_user = True

    select_hierarchy(root)
    supported = {
        prop.identifier
        for prop in bpy.ops.export_scene.gltf.get_rna_type().properties
    }
    options = {
        "filepath": str(output),
        "export_format": "GLB",
        "use_selection": True,
        "export_animations": True,
        "export_animation_mode": "ACTIONS",
        "export_all_actions": True,
        "export_nla_strips": False,
        "export_force_sampling": True,
        "export_frame_range": True,
        "export_frame_step": 1,
        "export_skins": True,
        "export_morph": True,
        "export_apply": False,
        "export_yup": True,
        "export_cameras": False,
        "export_lights": False,
        "export_extras": True,
        "export_materials": "EXPORT",
        "export_image_format": "AUTO",
    }
    filtered = {key: value for key, value in options.items() if key in supported}
    result = bpy.ops.export_scene.gltf(**filtered)
    if "FINISHED" not in result:
        fail(f"GLB export failed: {result}")
    if not output.is_file() or output.stat().st_size == 0:
        fail(f"GLB was not created: {output}")
    log(f"Exported {output} ({output.stat().st_size / 1024 / 1024:.2f} MiB)")


def main() -> None:
    args = parse_args()
    project_root = args.project_root.resolve()
    model_path = args.model.expanduser().resolve()
    clips = animation_sources(project_root)
    output = (
        project_root
        / "frontend"
        / "static"
        / "assets"
        / "characters"
        / "orelunza-citizen"
        / "orelunza-citizen.glb"
    )

    ensure_sources(model_path, clips)
    clear_scene()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.context.scene.render.fps = 30

    log(f"Importing target model: {model_path}")
    imported_target = import_fbx(model_path)
    target_armature = find_armature(imported_target)
    target_meshes = find_skinned_meshes(imported_target, target_armature)
    if not target_meshes:
        fail("Neutral_M imported, but no mesh is bound to its armature.")

    target_armature.name = "OrelunzaCitizenArmature"
    target_armature.data.name = "OrelunzaCitizenSkeleton"
    root = create_avatar_root(imported_target)
    normalize_avatar_root(root, args.height, args.yaw_degrees)

    for obj in imported_target:
        if obj.animation_data:
            obj.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)

    actions: dict[str, bpy.types.Action] = {}
    for name in REQUIRED_CLIPS:
        actions[name] = bake_clip(name, clips[name], target_armature)

    validate_asset(root, target_armature, target_meshes, actions)
    if not args.skip_renders:
        render_previews(root, target_armature, actions)
    export_glb(output, root, target_armature, actions)
    log("DONE")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        log(f"ERROR: {error}")
        raise
