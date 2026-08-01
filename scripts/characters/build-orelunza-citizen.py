from pathlib import Path
import sys

try:
    import bpy
except ImportError as error:
    raise SystemExit("This script must be run by Blender: blender --background --python scripts/characters/build-orelunza-citizen.py") from error


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "frontend" / "assets-source" / "characters" / "orelunza-citizen" / "mixamo"
OUTPUT = ROOT / "frontend" / "static" / "assets" / "characters" / "orelunza-citizen.glb"

CLIPS = {
    "idle": "base-idle.fbx",
    "walk": "walk.fbx",
    "run": "run.fbx",
    "strafe_left": "strafe-left.fbx",
    "strafe_right": "strafe-right.fbx",
    "walk_backward": "walk-backward.fbx",
    "jump": "jump.fbx",
    "fall": "fall.fbx",
    "land": "land.fbx",
    "reaction_shoved": "reaction-shoved-spin.fbx",
}


def require_file(path: Path) -> None:
    if not path.is_file():
        raise SystemExit(f"Missing source file: {path}")


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_fbx(path: Path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(path), automatic_bone_orientation=False)
    return [obj for obj in bpy.data.objects if obj not in before]


def find_armature(objects):
    for obj in objects:
        if obj.type == "ARMATURE":
            return obj
    return None


def remove_horizontal_root_motion(action) -> None:
    for curve in action.fcurves:
        if "Hips" not in curve.data_path or curve.array_index not in {0, 2}:
            continue

        first = curve.keyframe_points[0].co.y if curve.keyframe_points else 0
        for key in curve.keyframe_points:
            key.co.y = first
            key.handle_left.y = first
            key.handle_right.y = first


def rename_active_action(armature, name: str):
    if not armature or not armature.animation_data or not armature.animation_data.action:
        raise SystemExit(f"No action found for {name}")

    action = armature.animation_data.action
    action.name = name
    remove_horizontal_root_motion(action)
    return action


def main() -> None:
    for filename in CLIPS.values():
        require_file(SOURCE_DIR / filename)

    clear_scene()
    base_objects = import_fbx(SOURCE_DIR / "reaction-shoved-spin.fbx")
    base_armature = find_armature(base_objects)

    if not base_armature:
        raise SystemExit("The base FBX does not contain an armature.")

    if not any(obj.type == "MESH" and obj.find_armature() == base_armature for obj in base_objects):
        raise SystemExit("The base FBX does not contain a skinned mesh.")

    base_armature.name = "orelunza_citizen_armature"
    bpy.ops.object.select_all(action="DESELECT")

    actions = []
    for clip_name, filename in CLIPS.items():
        imported = import_fbx(SOURCE_DIR / filename)
        armature = find_armature(imported)
        action = rename_active_action(armature, clip_name)
        actions.append(action)

        if armature and armature != base_armature:
            bpy.data.objects.remove(armature, do_unlink=True)

        for obj in imported:
            if obj.type == "MESH":
                bpy.data.objects.remove(obj, do_unlink=True)

    base_armature.animation_data_create()
    base_armature.animation_data.action = bpy.data.actions.get("idle")

    for action in actions:
        action.use_fake_user = True

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.transform.resize(value=(0.01, 0.01, 0.01))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        export_animations=True,
        export_nla_strips=False,
        export_force_sampling=True,
        export_yup=True,
    )

    print(f"Exported {OUTPUT}")


if __name__ == "__main__":
    sys.exit(main())
