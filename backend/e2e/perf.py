"""Response times of the main read endpoints for a learner with plenty of data.

Run against the E2E backend (mock AI, throwaway database):
    python -m e2e.server            # in one terminal
    python -m e2e.perf              # in another
"""

import statistics
import sys
import time
import uuid

import httpx

API = "http://127.0.0.1:8001/api/v1"
TOPIC = {"topic": "Photosynthesis", "level": "beginner", "language": "en"}
ITEMS = int(sys.argv[1]) if len(sys.argv) > 1 else 15
RUNS = 30
PAGES = [
    "/users/me",
    "/lessons",
    "/conversations",
    "/quizzes",
    "/mindmaps",
    "/diagrams",
    "/videos",
    "/progress",
    "/languages",
    "/languages/de/vocabulary",
]


def seed(c: httpx.Client) -> dict[str, str]:
    email = f"perf-{uuid.uuid4().hex[:8]}@example.com"
    r = c.post(
        f"{API}/auth/register",
        json={"email": email, "password": "perf-check-123", "full_name": "Perf"},
    )
    r.raise_for_status()
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    c.put(f"{API}/languages/de", headers=h, json={"level": "A1"}).raise_for_status()
    for i in range(ITEMS):
        lesson = c.post(f"{API}/tutor/lessons", headers=h, json=TOPIC).json()
        c.post(
            f"{API}/tutor/conversations/{lesson['conversation']['id']}/reply",
            headers=h,
            json={"content": "More"},
        )
        quiz = c.post(f"{API}/quizzes", headers=h, json={**TOPIC, "question_count": 5}).json()
        answers = [{"question_id": q["id"], "answer": "x"} for q in quiz["questions"]]
        c.post(
            f"{API}/quizzes/{quiz['id']}/submit", headers=h, json={"answers": answers}
        ).raise_for_status()
        c.post(f"{API}/mindmaps", headers=h, json=TOPIC).raise_for_status()
        c.post(f"{API}/diagrams", headers=h, json=TOPIC).raise_for_status()
        c.post(f"{API}/languages/de/vocabulary/generate", headers=h, json={"topic": f"set {i}"})
    return h


def main() -> None:
    with httpx.Client(timeout=60) as c:
        t = time.perf_counter()
        h = seed(c)
        seconds = time.perf_counter() - t
        print(f"seeded {ITEMS} of each kind of item in {seconds:.1f}s\n")
        print(f"{'endpoint':28} {'p50 ms':>7} {'p95 ms':>7} {'max ms':>7}")
        for path in PAGES:
            times = []
            for _ in range(RUNS):
                t = time.perf_counter()
                c.get(f"{API}{path}", headers=h).raise_for_status()
                times.append((time.perf_counter() - t) * 1000)
            times.sort()
            p95 = times[int(len(times) * 0.95) - 1]
            print(f"{path:28} {statistics.median(times):7.1f} {p95:7.1f} {times[-1]:7.1f}")


if __name__ == "__main__":
    main()
