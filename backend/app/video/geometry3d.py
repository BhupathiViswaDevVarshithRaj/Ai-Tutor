"""Geometry for the 3D video scenes: molecule shapes and atom styles (no Manim needed)."""

import math

Vec = tuple[float, float, float]


def _unit(x: float, y: float, z: float) -> Vec:
    n = math.sqrt(x * x + y * y + z * z)
    return (x / n, y / n, z / n)


def _ring(count: int, z: float = 0.0, start: float = 0.0) -> list[Vec]:
    """`count` directions spread evenly around the z axis, tilted by `z`."""
    return [
        _unit(
            math.cos(start + 2 * math.pi * i / count), math.sin(start + 2 * math.pi * i / count), z
        )
        for i in range(count)
    ]


def _bent(angle_deg: float) -> list[Vec]:
    half = math.radians(angle_deg) / 2
    return [(math.sin(half), 0.0, -math.cos(half)), (-math.sin(half), 0.0, -math.cos(half))]


# Bond directions from the central atom for each VSEPR geometry (ideal angles; bent and
# trigonal pyramidal use water's 104.5° and ammonia's 107°).
# Three bonds (cos 120°, sin 120°, z) meet at angle a when z² = (0.5 + cos a) / (1 - cos a).
_COS_107 = math.cos(math.radians(107))
_PYRAMID_Z = -math.sqrt((0.5 + _COS_107) / (1 - _COS_107))
GEOMETRY_DIRECTIONS: dict[str, list[Vec]] = {
    "linear": [(1.0, 0.0, 0.0), (-1.0, 0.0, 0.0)],
    "bent": _bent(104.5),
    "trigonal_planar": _ring(3, start=math.pi / 2),
    "trigonal_pyramidal": _ring(3, z=_PYRAMID_Z, start=math.pi / 2),
    "tetrahedral": [_unit(1, 1, 1), _unit(1, -1, -1), _unit(-1, 1, -1), _unit(-1, -1, 1)],
    "trigonal_bipyramidal": [(0.0, 0.0, 1.0), (0.0, 0.0, -1.0), *_ring(3)],
    "octahedral": [
        (1.0, 0.0, 0.0),
        (-1.0, 0.0, 0.0),
        (0.0, 1.0, 0.0),
        (0.0, -1.0, 0.0),
        (0.0, 0.0, 1.0),
        (0.0, 0.0, -1.0),
    ],
}


def bond_directions(geometry: str, outer: int) -> list[Vec]:
    """Directions of the `outer` bonds (a diatomic 'linear' molecule has one)."""
    return GEOMETRY_DIRECTIONS[geometry][:outer]


def bond_angle(geometry: str) -> float:
    """The angle between the first two bonds, in degrees (for checks and captions)."""
    a, b = GEOMETRY_DIRECTIONS[geometry][:2]
    dot = sum(p * q for p, q in zip(a, b, strict=True))
    return math.degrees(math.acos(max(-1.0, min(1.0, dot))))


# CPK-style colours and relative sizes; anything else gets a neutral style.
ELEMENTS: dict[str, tuple[str, float]] = {
    "H": ("#F4F4F4", 0.28),
    "C": ("#3A3A3A", 0.42),
    "N": ("#2F5BEA", 0.42),
    "O": ("#E5322D", 0.42),
    "F": ("#56C26A", 0.38),
    "Cl": ("#1FB34A", 0.48),
    "Br": ("#A52A2A", 0.52),
    "I": ("#7B2FBE", 0.56),
    "S": ("#E8C21E", 0.50),
    "P": ("#F08A24", 0.50),
    "B": ("#F4A8A0", 0.40),
    "Si": ("#C8A27A", 0.50),
    "Xe": ("#3FA6C9", 0.56),
    "Be": ("#9ACD32", 0.40),
}
DEFAULT_ELEMENT = ("#B07CD8", 0.45)


def element_style(symbol: str) -> tuple[str, float]:
    return ELEMENTS.get(symbol, DEFAULT_ELEMENT)
