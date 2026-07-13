"""Generate The Current's reusable Confluence settlement prop kit.

Run inside Blender 5.x. The script writes a reproducible source .blend, an
uncompressed GLB for the build-time optimizer, and a studio preview render.

Coordinate contract:
- Blender source: metres, Z up, -Y forward.
- glTF/Three.js runtime: metres, +Y up, -Z forward.
- Every Asset_* root sits on ground at its local origin.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


REPO = Path(r"G:\My Drive\Codex Coworker\the-current")
SOURCE_BLEND = REPO / "assets" / "source" / "confluence-world-kit.blend"
RAW_GLB = REPO / "assets" / "generated" / "confluence-world-kit.raw.glb"
PREVIEW_PNG = REPO / "docs" / "screenshots" / "visual-pass" / "blender-confluence-kit.png"

SOURCE_BLEND.parent.mkdir(parents=True, exist_ok=True)
RAW_GLB.parent.mkdir(parents=True, exist_ok=True)
PREVIEW_PNG.parent.mkdir(parents=True, exist_ok=True)


def material(name: str, color, *, metallic=0.0, roughness=0.72, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if emission is not None:
        shader.inputs["Emission Color"].default_value = (*emission, 1.0)
        shader.inputs["Emission Strength"].default_value = strength
    return mat


def finish(obj, mat, *, bevel=0.06, smooth=False):
    obj.data.materials.append(mat)
    if bevel > 0:
        modifier = obj.modifiers.new("Hand-softened edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    if smooth and obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


EXPORT_OBJECTS = []


def root(name: str, position):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = position
    obj["asset_role"] = "runtime-root"
    obj["meters_per_unit"] = 1.0
    EXPORT_OBJECTS.append(obj)
    return obj


def attach(obj, parent):
    world_location = obj.location.copy()
    obj.parent = parent
    # Parenting in Blender otherwise keeps the existing coordinates as local
    # coordinates and applies the asset root offset a second time. Convert the
    # authored world placement to root-local placement so every exported
    # Asset_* node can be reset to (0, 0, 0) at runtime.
    obj.location = world_location - parent.location
    EXPORT_OBJECTS.append(obj)
    return obj


def cube(parent, name, location, scale, mat, *, rotation=(0, 0, 0), bevel=0.06):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return attach(finish(obj, mat, bevel=bevel), parent)


def cylinder(parent, name, location, radius, depth, mat, *, vertices=24, rotation=(0, 0, 0), bevel=0.04):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return attach(finish(obj, mat, bevel=bevel, smooth=True), parent)


def sphere(parent, name, location, scale, mat, *, ico=False):
    if ico:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=location)
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return attach(finish(obj, mat, bevel=0, smooth=True), parent)


def torus(parent, name, location, major, minor, mat, *, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=32,
        minor_segments=10,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return attach(finish(obj, mat, bevel=0, smooth=True), parent)


def cone(parent, name, location, radius1, radius2, depth, mat, *, vertices=20, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return attach(finish(obj, mat, bevel=0.04, smooth=True), parent)


def look_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


# Clean scene.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

# One deliberately limited shared palette.
CREAM = material("Confluence plaster", (0.68, 0.66, 0.54), roughness=0.88)
TIMBER = material("Oiled timber", (0.30, 0.19, 0.105), roughness=0.84)
TIMBER_LIGHT = material("Cut timber", (0.55, 0.36, 0.18), roughness=0.9)
METAL = material("Weathered metal", (0.22, 0.27, 0.26), metallic=0.62, roughness=0.43)
METAL_DARK = material("Forged dark metal", (0.07, 0.09, 0.09), metallic=0.7, roughness=0.36)
STONE = material("Warm local stone", (0.39, 0.38, 0.32), roughness=0.96)
STONE_LIGHT = material("Cut pale stone", (0.58, 0.56, 0.47), roughness=0.94)
CANVAS = material("Trade canvas", (0.58, 0.16, 0.10), roughness=0.82)
CANVAS_LIGHT = material("Trade canvas cream", (0.84, 0.67, 0.42), roughness=0.86)
GREEN = material("Crop leaf", (0.25, 0.42, 0.22), roughness=0.92)
GOLD = material("Harvest gold", (0.72, 0.50, 0.13), roughness=0.82)
WATER = material("Stored water", (0.08, 0.42, 0.52), metallic=0.12, roughness=0.22)
COPPER = material("Aged copper", (0.56, 0.23, 0.10), metallic=0.72, roughness=0.34)
LIGHT = material("Warm civic light", (0.95, 0.72, 0.32), roughness=0.22, emission=(1.0, 0.5, 0.12), strength=4.0)


def make_market(origin):
    r = root("Asset_MarketStall", origin)
    cube(r, "market.foundation", (origin[0], origin[1], 0.09), (1.8, 1.15, 0.09), STONE_LIGHT, bevel=0.08)
    for x in (-1.55, 1.55):
        for y in (-0.88, 0.88):
            cube(r, f"market.post.{x}.{y}", (origin[0] + x, origin[1] + y, 1.25), (0.09, 0.09, 1.25), TIMBER, bevel=0.035)
    cube(r, "market.counter", (origin[0], origin[1] - 0.78, 0.85), (1.65, 0.34, 0.12), TIMBER_LIGHT, bevel=0.055)
    cube(r, "market.counter-front", (origin[0], origin[1] - 0.84, 0.46), (1.55, 0.12, 0.34), TIMBER, bevel=0.04)
    for index, x in enumerate((-1.2, -0.4, 0.4, 1.2)):
        cube(r, f"market.canopy.{index}", (origin[0] + x, origin[1], 2.72), (0.41, 1.18, 0.075), CANVAS if index % 2 == 0 else CANVAS_LIGHT, rotation=(0, math.radians(5) * (1 if x > 0 else -1), 0), bevel=0.025)
    for index, (x, y, color) in enumerate(((-0.95, -0.98, GREEN), (-0.15, -0.98, GOLD), (0.75, -0.98, CANVAS))):
        cube(r, f"market.crate.{index}", (origin[0] + x, origin[1] + y, 0.55), (0.34, 0.30, 0.26), TIMBER_LIGHT, bevel=0.035)
        for item in range(5):
            sphere(r, f"market.goods.{index}.{item}", (origin[0] + x + (item % 3 - 1) * 0.13, origin[1] + y - 0.04, 0.86 + (item // 3) * 0.12), (0.09, 0.09, 0.09), color, ico=True)
    return r


def make_waterworks(origin):
    r = root("Asset_WaterWorks", origin)
    cube(r, "water.foundation", (origin[0], origin[1], 0.11), (1.55, 1.38, 0.11), STONE_LIGHT, bevel=0.09)
    for x in (-1.05, 1.05):
        for y in (-0.82, 0.82):
            cylinder(r, f"water.leg.{x}.{y}", (origin[0] + x, origin[1] + y, 1.25), 0.09, 2.45, METAL_DARK, vertices=12)
    cylinder(r, "water.tank", (origin[0], origin[1], 2.45), 1.28, 1.45, WATER, vertices=32, bevel=0.08)
    cone(r, "water.tank-roof", (origin[0], origin[1], 3.32), 1.34, 0.22, 0.42, COPPER, vertices=32)
    for z in (2.02, 2.88):
        torus(r, f"water.band.{z}", (origin[0], origin[1], z), 1.29, 0.045, METAL_DARK)
    cylinder(r, "water.pipe", (origin[0] + 1.1, origin[1], 0.74), 0.08, 1.5, COPPER, vertices=14)
    cube(r, "water.pump", (origin[0] + 1.15, origin[1] - 0.42, 0.55), (0.34, 0.28, 0.46), METAL, bevel=0.12)
    return r


def make_timber(origin):
    r = root("Asset_TimberYard", origin)
    cube(r, "timber.pad", (origin[0], origin[1], 0.07), (2.15, 1.35, 0.07), STONE, bevel=0.04)
    for x in (-1.78, 1.78):
        for y in (-1.0, 1.0):
            cube(r, f"timber.rack.{x}.{y}", (origin[0] + x, origin[1] + y, 0.76), (0.09, 0.09, 0.76), METAL_DARK, bevel=0.03)
    for row in range(3):
        for col in range(5):
            cylinder(r, f"timber.log.{row}.{col}", (origin[0] - 1.35 + col * 0.68, origin[1] - 0.45 + row * 0.42, 0.34 + row * 0.22), 0.18, 2.15, TIMBER_LIGHT, vertices=12, rotation=(math.pi / 2, 0, 0), bevel=0.025)
    for index in range(6):
        cube(r, f"timber.plank.{index}", (origin[0] - 1.45 + index * 0.58, origin[1] + 0.78, 0.43 + index * 0.035), (0.25, 0.82, 0.075), TIMBER_LIGHT, bevel=0.018)
    return r


def make_stone(origin):
    r = root("Asset_StoneDepot", origin)
    cube(r, "stone.pad", (origin[0], origin[1], 0.06), (2.05, 1.45, 0.06), STONE, bevel=0.03)
    for x in (-1.82, 1.82):
        cube(r, f"stone.bin-side.{x}", (origin[0] + x, origin[1], 0.52), (0.14, 1.32, 0.52), TIMBER, bevel=0.035)
    cube(r, "stone.bin-back", (origin[0], origin[1] + 1.18, 0.52), (1.85, 0.14, 0.52), TIMBER, bevel=0.035)
    for index in range(18):
        x = -1.45 + (index % 6) * 0.57
        y = -0.62 + (index // 6) * 0.55
        z = 0.27 + (index % 3) * 0.10
        sphere(r, f"stone.rock.{index}", (origin[0] + x, origin[1] + y, z), (0.28 + (index % 2) * 0.08, 0.24, 0.22 + (index % 3) * 0.06), STONE_LIGHT if index % 4 else STONE, ico=True)
    return r


def make_generator(origin):
    r = root("Asset_Generator", origin)
    cube(r, "generator.foundation", (origin[0], origin[1], 0.09), (1.52, 1.0, 0.09), STONE_LIGHT, bevel=0.07)
    cube(r, "generator.body", (origin[0], origin[1], 0.82), (1.2, 0.76, 0.72), METAL, bevel=0.18)
    cube(r, "generator.panel", (origin[0], origin[1] - 0.78, 0.9), (0.58, 0.045, 0.38), METAL_DARK, bevel=0.04)
    for index, x in enumerate((-0.32, 0.0, 0.32)):
        sphere(r, f"generator.indicator.{index}", (origin[0] + x, origin[1] - 0.835, 1.02), (0.055, 0.055, 0.055), LIGHT if index == 1 else COPPER)
    cylinder(r, "generator.flywheel", (origin[0] + 1.16, origin[1], 0.84), 0.5, 0.16, METAL_DARK, vertices=24, rotation=(0, math.pi / 2, 0))
    torus(r, "generator.flywheel-rim", (origin[0] + 1.26, origin[1], 0.84), 0.36, 0.06, COPPER, rotation=(0, math.pi / 2, 0))
    cylinder(r, "generator.exhaust", (origin[0] - 0.78, origin[1] + 0.32, 1.85), 0.12, 1.45, METAL_DARK, vertices=14)
    cylinder(r, "generator.exhaust-cap", (origin[0] - 0.78, origin[1] + 0.32, 2.57), 0.18, 0.12, COPPER, vertices=14)
    return r


def make_lamp(origin):
    r = root("Asset_StreetLamp", origin)
    cylinder(r, "lamp.base", (origin[0], origin[1], 0.16), 0.32, 0.32, STONE_LIGHT, vertices=16)
    cylinder(r, "lamp.pole", (origin[0], origin[1], 1.65), 0.075, 3.0, METAL_DARK, vertices=12)
    cube(r, "lamp.arm", (origin[0] + 0.34, origin[1], 3.0), (0.38, 0.065, 0.065), METAL_DARK, bevel=0.04)
    cone(r, "lamp.cap", (origin[0] + 0.72, origin[1], 2.88), 0.28, 0.16, 0.18, COPPER, vertices=12)
    sphere(r, "lamp.glow", (origin[0] + 0.72, origin[1], 2.69), (0.20, 0.20, 0.24), LIGHT)
    return r


def make_bench(origin):
    r = root("Asset_Bench", origin)
    for x in (-1.0, 1.0):
        cube(r, f"bench.leg.{x}", (origin[0] + x, origin[1], 0.38), (0.08, 0.35, 0.38), METAL_DARK, bevel=0.035)
    for index in range(4):
        cube(r, f"bench.seat.{index}", (origin[0], origin[1] - 0.36 + index * 0.24, 0.72), (1.25, 0.09, 0.055), TIMBER_LIGHT, bevel=0.035)
    for index in range(4):
        cube(r, f"bench.back.{index}", (origin[0], origin[1] + 0.34, 1.04 + index * 0.19), (1.25, 0.055, 0.065), TIMBER, rotation=(math.radians(-8), 0, 0), bevel=0.035)
    return r


def make_farm(origin):
    r = root("Asset_FarmStand", origin)
    cube(r, "farm.foundation", (origin[0], origin[1], 0.08), (1.65, 1.25, 0.08), STONE_LIGHT, bevel=0.06)
    for x in (-1.35, 1.35):
        cube(r, f"farm.post.{x}", (origin[0] + x, origin[1], 1.25), (0.1, 0.1, 1.2), TIMBER, bevel=0.035)
    cube(r, "farm.roof-a", (origin[0] - 0.68, origin[1], 2.38), (0.82, 1.42, 0.09), CANVAS_LIGHT, rotation=(0, math.radians(-19), 0), bevel=0.025)
    cube(r, "farm.roof-b", (origin[0] + 0.68, origin[1], 2.38), (0.82, 1.42, 0.09), CANVAS, rotation=(0, math.radians(19), 0), bevel=0.025)
    for index in range(5):
        cylinder(r, f"farm.sack.{index}", (origin[0] - 1.08 + index * 0.54, origin[1] - 0.52 + (index % 2) * 0.42, 0.46), 0.29, 0.72, CANVAS_LIGHT, vertices=14, bevel=0.08)
    cube(r, "farm.table", (origin[0], origin[1] + 0.62, 0.92), (1.18, 0.42, 0.10), TIMBER_LIGHT, bevel=0.05)
    return r


def make_cart(origin):
    r = root("Asset_CargoCart", origin)
    cube(r, "cart.chassis", (origin[0], origin[1], 0.66), (1.02, 1.65, 0.16), TIMBER, bevel=0.08)
    cube(r, "cart.bed", (origin[0], origin[1] + 0.08, 1.02), (0.9, 1.48, 0.22), TIMBER_LIGHT, bevel=0.06)
    for x in (-1.05, 1.05):
        for y in (-0.95, 0.95):
            cylinder(r, f"cart.wheel.{x}.{y}", (origin[0] + x, origin[1] + y, 0.54), 0.48, 0.18, METAL_DARK, vertices=20, rotation=(0, math.pi / 2, 0))
            cylinder(r, f"cart.hub.{x}.{y}", (origin[0] + x * 1.02, origin[1] + y, 0.54), 0.16, 0.24, COPPER, vertices=16, rotation=(0, math.pi / 2, 0))
    for index, y in enumerate((-0.75, 0.15, 0.85)):
        cube(r, f"cart.cargo.{index}", (origin[0] + (-0.28 if index % 2 else 0.28), origin[1] + y, 1.46), (0.52, 0.38, 0.36), CANVAS_LIGHT if index == 1 else TIMBER_LIGHT, bevel=0.07)
    cube(r, "cart.drawbar", (origin[0], origin[1] - 2.35, 0.65), (0.12, 0.95, 0.10), METAL_DARK, bevel=0.04)
    return r


make_market((-9.5, 3.4, 0))
make_waterworks((-4.8, 3.4, 0))
make_timber((0.0, 3.4, 0))
make_stone((5.0, 3.4, 0))
make_generator((9.8, 3.4, 0))
make_lamp((-8.5, -3.2, 0))
make_bench((-4.0, -3.2, 0))
make_farm((1.0, -3.2, 0))
make_cart((7.0, -3.2, 0))

# Collapse each authored asset into one mesh object before export. Materials
# remain as shared slots/primitives, but small construction parts no longer
# become a separate Three.js object and draw submission at runtime.
for asset_root in [obj for obj in EXPORT_OBJECTS if obj.parent is None and obj.type == "EMPTY"]:
    parts = [obj for obj in EXPORT_OBJECTS if obj.parent == asset_root and obj.type == "MESH"]
    if len(parts) <= 1:
        continue
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = f"{asset_root.name}.mesh"
    for part in parts[1:]:
        if part in EXPORT_OBJECTS:
            EXPORT_OBJECTS.remove(part)

# Runtime metadata on roots.
for obj in EXPORT_OBJECTS:
    if obj.parent is None and obj.type == "EMPTY":
        obj["ground_origin"] = True
        obj["forward_axis"] = "-Y"
        obj["collision_proxy"] = "authoritative placement footprint"

# Export runtime objects only; preview rig remains source-only.
bpy.ops.object.select_all(action="DESELECT")
for obj in EXPORT_OBJECTS:
    obj.select_set(True)
bpy.context.view_layer.objects.active = EXPORT_OBJECTS[0]
bpy.ops.export_scene.gltf(
    filepath=str(RAW_GLB),
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_attributes=True,
    export_extras=True,
    export_cameras=False,
    export_lights=False,
)

# Preview floor, camera, and lighting are intentionally absent from the GLB.
bpy.ops.mesh.primitive_plane_add(size=34, location=(0, 0, -0.035))
preview_floor = bpy.context.object
preview_floor.name = "Preview studio floor"
preview_floor.data.materials.append(material("Preview floor", (0.035, 0.06, 0.055), roughness=0.6))

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1500
scene.render.resolution_y = 850
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(PREVIEW_PNG)
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.008, 0.014, 0.015, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.3

bpy.ops.object.camera_add(location=(0.0, -39.0, 30.0))
camera = bpy.context.object
camera.name = "Confluence kit preview camera"
camera.data.lens = 44
look_at(camera, (0, 0.2, 1.0))
scene.camera = camera

def area(name, location, energy, color, size):
    bpy.ops.object.light_add(type="AREA", location=location)
    lamp = bpy.context.object
    lamp.name = name
    lamp.data.energy = energy
    lamp.data.color = color
    lamp.data.shape = "DISK"
    lamp.data.size = size
    look_at(lamp, (0, 0, 1))


area("Preview warm key", (-8, -10, 16), 1900, (1.0, 0.63, 0.35), 8)
area("Preview cool fill", (10, -4, 12), 1400, (0.35, 0.72, 1.0), 7)
area("Preview rim", (0, 12, 10), 1700, (0.18, 0.50, 0.46), 6)

scene.view_settings.look = "AgX - Medium High Contrast"
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND))
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND))

print(f"CONFLUENCE_KIT_DONE::{SOURCE_BLEND}::{RAW_GLB}::{PREVIEW_PNG}")
