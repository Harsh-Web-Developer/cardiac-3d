from pathlib import Path
import re


SOURCE_FILE = Path("data/source/cardia_physiology.md")
OUTPUT_FILE = Path("data/clean/cardia_physiology.txt")


def clean_markdown(text: str) -> str:
    # Remove Markdown headings markers
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)

    # Remove blockquote markers
    text = re.sub(r"^>\s?", "", text, flags=re.MULTILINE)

    # Remove Markdown emphasis markers
    text = text.replace("**", "")
    text = text.replace("__", "")
    text = text.replace("*", "")

    # Normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)

    # Reduce excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def main():
    if not SOURCE_FILE.exists():
        raise FileNotFoundError(
            f"Source file not found: {SOURCE_FILE}"
        )

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    raw_text = SOURCE_FILE.read_text(
        encoding="utf-8"
    )

    cleaned_text = clean_markdown(raw_text)

    OUTPUT_FILE.write_text(
        cleaned_text,
        encoding="utf-8"
    )

    print("Extraction complete.")
    print(f"Source: {SOURCE_FILE}")
    print(f"Output: {OUTPUT_FILE}")
    print(f"Characters: {len(cleaned_text)}")


if __name__ == "__main__":
    main()