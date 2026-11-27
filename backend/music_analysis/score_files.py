"""
Read an uploaded score as plain (uncompressed) MusicXML.

The original score is stored with its practice session so the frontend
can render it. Compressed .mxl uploads are unpacked first, so the
frontend always receives plain MusicXML.
"""

import zipfile
import xml.etree.ElementTree as ElementTree
from pathlib import Path


CONTAINER_PATH = "META-INF/container.xml"
MUSICXML_SUFFIXES = (".xml", ".musicxml")


def _root_file_name(archive):
    """Return the main score's name inside a compressed .mxl archive."""
    names = archive.namelist()

    if CONTAINER_PATH in names:
        container = ElementTree.fromstring(archive.read(CONTAINER_PATH))

        for element in container.iter():
            # Tag names may carry an XML namespace.
            if element.tag.split("}")[-1] == "rootfile":
                full_path = element.get("full-path")

                if full_path in names:
                    return full_path

    # Without a usable container file, use the first MusicXML file.
    for name in names:
        if (
            not name.startswith("META-INF/")
            and name.lower().endswith(MUSICXML_SUFFIXES)
        ):
            return name

    raise ValueError("The .mxl file does not contain a MusicXML score.")


def read_musicxml_bytes(file_path, suffix=None):
    """
    Return the score at file_path as plain MusicXML bytes.

    Args:
        file_path: Path to an uploaded .xml, .musicxml, or .mxl file.
        suffix: The upload's file extension. Defaults to the extension
                of file_path.

    Raises:
        ValueError: If a .mxl file is not a valid compressed score.
    """
    suffix = (suffix or Path(file_path).suffix).lower()

    if suffix != ".mxl":
        return Path(file_path).read_bytes()

    try:
        with zipfile.ZipFile(file_path) as archive:
            return archive.read(_root_file_name(archive))
    except (zipfile.BadZipFile, ElementTree.ParseError) as exc:
        raise ValueError(
            "The .mxl file is not a valid compressed MusicXML score."
        ) from exc
