# Builds data.js from content/*.json: course modules in course order, then past CKE exam papers (oldest first).
import json, os, glob
here = os.path.dirname(os.path.abspath(__file__))
course_modules = [
    ("ppr", 8), ("bhp", 2), ("ur", 8), ("ppz", 8), ("pz", 8), ("tr", 8), ("re", 4), ("bpc", 8), ("tpc", 8),
]
order = [f"{prefix}{i}" for prefix, count in course_modules for i in range(1, count + 1)]
order += sorted(os.path.basename(p)[:-5] for p in glob.glob(os.path.join(here, "content", "exam_*.json")))
modules = []
for module_id in order:
    path = os.path.join(here, "content", module_id + ".json")
    if not os.path.exists(path):
        print("missing", module_id); continue
    m = json.load(open(path))
    assert m["id"] == module_id, (path, m["id"])
    assert m["flashcards"] and m["quiz"], module_id
    for q in m["quiz"]:
        assert len(q["options"]) == 4 and 0 <= q["answer"] <= 3, (module_id, q["q"])
    # Moodle questions (Samoewaluacja, Test wiedzy): 2–9 options (true/false included), one or more correct answers
    for q in m.get("selftest", []) + m.get("knowledgetest", []):
        assert len(q["options"]) >= 2 and q["answers"] and all(0 <= a < len(q["options"]) for a in q["answers"]), (module_id, q["q"])
        assert q.get("multi") or len(q["answers"]) == 1, (module_id, q["q"])
    images = [i["src"] for s in m["notes"] for i in s.get("images", [])] + [x["img"] for x in m["flashcards"] + m["quiz"] + m.get("selftest", []) + m.get("knowledgetest", []) if "img" in x]
    for src in images:
        assert os.path.exists(os.path.join(here, src)), (module_id, "missing image", src)
    modules.append(m)
    print(module_id, len(m["notes"]), "sections", len(m["flashcards"]), "cards", len(m["quiz"]), "questions", len(m.get("selftest", [])), "selftest", len(m.get("knowledgetest", [])), "knowledgetest", len(images), "images")
print("TOTAL", len(modules), "modules", sum(len(m["flashcards"]) for m in modules), "cards", sum(len(m["quiz"]) for m in modules), "questions",
      sum(len(m.get("selftest", [])) for m in modules), "selftest", sum(len(m.get("knowledgetest", [])) for m in modules), "knowledgetest")
with open(os.path.join(here, "data.js"), "w") as f:
    f.write("const COURSE_DATA = " + json.dumps(modules, ensure_ascii=False) + ";\n")
