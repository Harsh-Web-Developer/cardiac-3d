import json
import re
from pathlib import Path


# ---------------------------------------------------------
# Paths
# ---------------------------------------------------------

INPUT_FILE = Path("data/clean/cardia_physiology.txt")
OUTPUT_FILE = Path("data/chunks/cardia_chunks.json")


# ---------------------------------------------------------
# Source provenance
# ---------------------------------------------------------

SOURCE_METADATA = {
    "source": "cardia_physiology.md",
    "source_title": "CARDIA Internal Physiology Notes",
    "source_type": "internal_educational_notes",
    "authority_level": "project_reference",
    "author": "CARDIA Team",
}


# ---------------------------------------------------------
# Main CARDIA section titles
# ---------------------------------------------------------

MAIN_SECTIONS = [
    "CARDIA Simulation Variables",
    "Heart Rate",
    "Stroke Volume",
    "Cardiac Output",
    "End-Diastolic Volume",
    "End-Systolic Volume",
    "Cardiac Conduction System",
    "SA Node",
    "AV Node",
    "Bundle of His",
    "Purkinje Fibers",
    "Cardiac Valves",
    "Mitral Valve",
    "Aortic Valve",
    "Tricuspid Valve",
    "Pulmonary Valve",
    "Blood Pressure",
    "Mean Arterial Pressure",
    "Systemic Vascular Resistance",
    "Left Ventricular Pressure",
    "Aortic Pressure",
    "Contractility",
    "Blood Volume",
    "Cardiac Cycle",
    "Cause-and-Effect Reasoning Rules",
    "Current CARDIA Baseline State",
    "Evidence Sources",
    "RAG Safety Rules",
    "Source Provenance",
]


# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------

def normalize_title(title):
    title = re.sub(r"^\d+\.\s*", "", title)
    title = re.sub(r"\s+", " ", title)
    return title.strip()


def is_main_section_title(line):
    """
    Only the known CARDIA section titles are treated
    as new sections.

    This prevents numbered reasoning rules such as:

    1. Identify what changed...
    2. Retrieve relevant evidence...

    from becoming separate chunks.
    """

    normalized = normalize_title(line.strip())

    return normalized in MAIN_SECTIONS


# ---------------------------------------------------------
# Section splitting
# ---------------------------------------------------------

def split_sections(text):
    lines = text.splitlines()

    sections = []

    current_title = None
    current_lines = []

    for line in lines:

        stripped = line.strip()

        if not stripped:
            continue

        if is_main_section_title(stripped):

            if current_title is not None:

                sections.append(
                    {
                        "title": normalize_title(current_title),
                        "text": "\n".join(current_lines).strip(),
                    }
                )

            current_title = stripped
            current_lines = []

        else:

            current_lines.append(stripped)

    if current_title is not None:

        sections.append(
            {
                "title": normalize_title(current_title),
                "text": "\n".join(current_lines).strip(),
            }
        )

    return sections


# ---------------------------------------------------------
# Metadata: topic
# ---------------------------------------------------------

def determine_topic(title):

    title_lower = title.lower()

    topic_map = {

        "cardia simulation variables":
            "simulation_variables",

        "heart rate":
            "cardiac_rate",

        "stroke volume":
            "cardiac_output",

        "cardiac output":
            "cardiac_output",

        "end-diastolic volume":
            "ventricular_filling",

        "end-systolic volume":
            "ventricular_emptying",

        "cardiac conduction system":
            "cardiac_conduction",

        "sa node":
            "cardiac_conduction",

        "av node":
            "cardiac_conduction",

        "bundle of his":
            "cardiac_conduction",

        "purkinje fibers":
            "cardiac_conduction",

        "cardiac valves":
            "cardiac_valves",

        "mitral valve":
            "cardiac_valves",

        "aortic valve":
            "cardiac_valves",

        "tricuspid valve":
            "cardiac_valves",

        "pulmonary valve":
            "cardiac_valves",

        "blood pressure":
            "hemodynamics",

        "mean arterial pressure":
            "hemodynamics",

        "systemic vascular resistance":
            "hemodynamics",

        "left ventricular pressure":
            "ventricular_hemodynamics",

        "aortic pressure":
            "arterial_hemodynamics",

        "contractility":
            "ventricular_contractility",

        "blood volume":
            "circulating_volume",

        "cardiac cycle":
            "cardiac_cycle",

        "cause-and-effect reasoning rules":
            "causal_reasoning",

        "current cardia baseline state":
            "simulation_state",

        "evidence sources":
            "provenance",

        "rag safety rules":
            "safety",

        "source provenance":
            "provenance",
    }

    return topic_map.get(
        title_lower,
        "cardiovascular_physiology"
    )


# ---------------------------------------------------------
# Metadata: organ
# ---------------------------------------------------------

def determine_organ(title):

    title_lower = title.lower()

    conduction_keywords = [
        "sa node",
        "av node",
        "bundle of his",
        "purkinje",
        "conduction",
    ]

    if any(
        keyword in title_lower
        for keyword in conduction_keywords
    ):
        return "cardiac_conduction_system"

    if "valve" in title_lower:
        return "heart"

    heart_keywords = [
        "heart rate",
        "stroke volume",
        "cardiac output",
        "end-diastolic volume",
        "end-systolic volume",
        "contractility",
        "cardiac cycle",
        "left ventricular pressure",
    ]

    if any(
        keyword in title_lower
        for keyword in heart_keywords
    ):
        return "heart"

    cardiovascular_keywords = [
        "blood pressure",
        "mean arterial pressure",
        "systemic vascular resistance",
        "blood volume",
        "aortic pressure",
    ]

    if any(
        keyword in title_lower
        for keyword in cardiovascular_keywords
    ):
        return "cardiovascular_system"

    return "cardiovascular_system"


# ---------------------------------------------------------
# Metadata: mechanism
# ---------------------------------------------------------

def determine_mechanism(title, text):

    combined = f"{title} {text}".lower()

    mechanisms = []

    if (
        "co =" in combined
        or "cardiac output" in combined
    ):
        mechanisms.append(
            "cardiac_output"
        )

    if (
        "sv = edv - esv" in combined
        or "stroke volume" in combined
    ):
        mechanisms.append(
            "stroke_volume"
        )

    if (
        "conduction" in combined
        or "sa node" in combined
        or "av node" in combined
    ):
        mechanisms.append(
            "electrical_conduction"
        )

    if "valve" in combined:
        mechanisms.append(
            "directional_blood_flow"
        )

    if (
        "map" in combined
        or "mean arterial pressure" in combined
    ):
        mechanisms.append(
            "arterial_pressure"
        )

    if "contractility" in combined:
        mechanisms.append(
            "ventricular_contractility"
        )

    if "blood volume" in combined:
        mechanisms.append(
            "circulating_volume"
        )

    if not mechanisms:
        mechanisms.append(
            "cardiovascular_physiology"
        )

    return mechanisms


# ---------------------------------------------------------
# Metadata: equations
# ---------------------------------------------------------

def extract_equations(text):

    equations = []

    patterns = [

        r"CO\s*=\s*HR\s*[×x*]\s*SV",

        r"SV\s*=\s*EDV\s*-\s*ESV",

        r"MAP\s*[≈=]\s*DBP\s*\+\s*1/3\s*\(\s*SBP\s*-\s*DBP\s*\)",

        r"MAP\s*=\s*\(\s*SBP\s*\+\s*2\s*[×x*]\s*DBP\s*\)\s*/\s*3",
    ]

    for pattern in patterns:

        matches = re.findall(
            pattern,
            text,
            flags=re.IGNORECASE
        )

        for match in matches:

            if match not in equations:
                equations.append(match)

    return equations


# ---------------------------------------------------------
# Metadata: chapter
# ---------------------------------------------------------

def determine_chapter(title):

    title_lower = title.lower()

    if title_lower in [
        "heart rate",
        "stroke volume",
        "cardiac output",
        "end-diastolic volume",
        "end-systolic volume",
        "cardiac cycle",
        "contractility",
    ]:
        return "Cardiac Function"

    if title_lower in [
        "cardiac conduction system",
        "sa node",
        "av node",
        "bundle of his",
        "purkinje fibers",
    ]:
        return "Cardiac Electrophysiology"

    if "valve" in title_lower:
        return "Cardiac Valves"

    if title_lower in [
        "blood pressure",
        "mean arterial pressure",
        "systemic vascular resistance",
        "aortic pressure",
        "left ventricular pressure",
    ]:
        return "Cardiovascular Hemodynamics"

    if title_lower == "blood volume":
        return "Circulating Volume"

    if title_lower in [
        "cause-and-effect reasoning rules",
        "current cardia baseline state",
    ]:
        return "CARDIA Simulation Reasoning"

    return "CARDIA Reference Material"


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main():

    if not INPUT_FILE.exists():

        raise FileNotFoundError(
            f"Input file not found: {INPUT_FILE}"
        )

    text = INPUT_FILE.read_text(
        encoding="utf-8"
    )

    sections = split_sections(text)

    chunks = []

    for index, section in enumerate(
        sections,
        start=1
    ):

        title = section["title"]
        section_text = section["text"]

        topic = determine_topic(title)

        organ = determine_organ(title)

        mechanisms = determine_mechanism(
            title,
            section_text
        )

        equations = extract_equations(
            section_text
        )

        chapter = determine_chapter(title)

        chunk = {

            "chunk_id":
                f"cardia_{index:03d}",

            "title":
                title,

            "text":
                section_text,

            "source":
                SOURCE_METADATA["source"],

            "source_title":
                SOURCE_METADATA["source_title"],

            "source_type":
                SOURCE_METADATA["source_type"],

            "authority_level":
                SOURCE_METADATA["authority_level"],

            "author":
                SOURCE_METADATA["author"],

            "chapter":
                chapter,

            "topic":
                topic,

            "organ":
                organ,

            "mechanism":
                mechanisms,

            "equation":
                equations,

            "page":
                None,
        }

        chunks.append(chunk)

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            chunks,
            file,
            indent=2,
            ensure_ascii=False
        )

    print()
    print("Metadata chunking complete.")
    print(f"Input: {INPUT_FILE}")
    print(f"Output: {OUTPUT_FILE}")
    print(f"Chunks created: {len(chunks)}")
    print()

    for chunk in chunks:

        print(
            f"[{chunk['chunk_id']}] "
            f"{chunk['title']} "
            f"→ "
            f"topic={chunk['topic']}, "
            f"organ={chunk['organ']}, "
            f"mechanism={chunk['mechanism']}, "
            f"source={chunk['source_title']}"
        )


if __name__ == "__main__":
    main()