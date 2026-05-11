import json
import os
import sys


def normalize_text(value):
    return "\n".join(line.strip() for line in str(value or "").splitlines() if line.strip())


def collect_text(value, output):
    if value is None:
        return

    if isinstance(value, str):
        text = value.strip()
        if text and len(text) > 1 and not text.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            output.append(text)
        return

    if isinstance(value, dict):
        for key in ("rec_texts", "texts"):
            items = value.get(key)
            if isinstance(items, list):
                for item in items:
                    collect_text(item, output)

        for key in ("text", "label"):
            if isinstance(value.get(key), str):
                collect_text(value[key], output)

        for item in value.values():
            if isinstance(item, (dict, list, tuple)):
                collect_text(item, output)
        return

    if isinstance(value, (list, tuple)):
        # PaddleOCR classic format: [box, (text, confidence)]
        if len(value) >= 2 and isinstance(value[1], (list, tuple)) and value[1] and isinstance(value[1][0], str):
            collect_text(value[1][0], output)
            return

        for item in value:
            collect_text(item, output)


def result_to_text(result):
    collected = []
    collect_text(result, collected)
    seen = set()
    unique = []
    for item in collected:
        text = normalize_text(item)
        if text and text not in seen:
            seen.add(text)
            unique.append(text)
    return "\n".join(unique)


def create_paddle_ocr():
    from paddleocr import PaddleOCR

    lang = os.getenv("PADDLEOCR_LANG", "arabic")
    try:
        return PaddleOCR(
            lang=lang,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=True,
        )
    except TypeError:
        return PaddleOCR(use_angle_cls=True, lang=lang)


def run_paddle(paths):
    ocr = create_paddle_ocr()
    parts = []

    for index, image_path in enumerate(paths, start=1):
        try:
            if hasattr(ocr, "predict"):
                result = ocr.predict(image_path)
            else:
                result = ocr.ocr(image_path, cls=True)

            text = result_to_text(result)
            if text:
                parts.append(f"Image {index}:\n{text}")
        except Exception as exc:
            print(f"[PaddleOCR] failed on {image_path}: {exc}", file=sys.stderr)

    return normalize_text("\n\n".join(parts))


def main():
    paths = [p for p in sys.argv[1:] if p]
    if not paths:
        print(json.dumps({"engine": "paddleocr", "text": ""}, ensure_ascii=False))
        return 0

    try:
        text = run_paddle(paths)
        print(json.dumps({"engine": "paddleocr", "text": text}, ensure_ascii=False))
        return 0
    except ModuleNotFoundError as exc:
        print(f"PaddleOCR is not installed: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"PaddleOCR failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
