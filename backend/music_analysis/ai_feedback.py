
"""Generate grounded practice feedback using local Ollama."""

import json
import os
import logging
import httpx
from pydantic import BaseModel, Field, ValidationError

from music_analysis.ai_feedback_planner import build_feedback_plan

logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv(
    "OLLAMA_URL",
    "http://localhost:11434/api/generate",
)
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")


class PracticeRecommendation(BaseModel):
    measure: int | None
    error_type: str
    exercise: str = Field(min_length=10)


class AIPracticeFeedback(BaseModel):
    overall_assessment: str
    recommendations: list[PracticeRecommendation]
    next_session_goal: str


SYSTEM_PROMPT = """
You are the practice instructor for a Virtual Music Instructor app.

The provided JSON contains verified performance-analysis results.
You must not perform your own audio analysis.

Generate actionable exercises for the detected errors.

STRICT RULES:
1. Use only errors listed in selected_errors.
2. Every recommendation must use an exact measure and error_type
   combination from selected_errors.
3. Explain how to perform each exercise and what it improves.
4. The application has already selected the highest-priority
   errors. You must generate exercises for those selected errors
   only. Do not reprioritize or substitute other detected errors.
5. Generate at most three recommendations.
6. Never invent note names, tempo values, or performance statistics.
7. Do not recommend unrelated musical pieces.
8. If no errors are detected, return an empty recommendations list.
9. Keep the overall assessment concise and constructive.
10. Return only valid JSON matching the provided schema.
11. Each exercise must target the specific error_type:
    - incorrect_pitch: isolate the incorrect pitch and compare it
      with a reliable pitch reference.
    - late_note: practice starting the note on the correct beat.
    - early_note: practice waiting until the correct beat.
    - short_duration: practice sustaining the note for its full
      written duration.
    - long_duration: practice releasing the note at the correct beat.
    - missing_note: practice including the omitted note.
    - additional_note: practice removing the unintended note.
12. Do not give identical or nearly identical exercises for
    different error types.
13. Refer to the specific measure in each exercise.
14. Do not invent practice schedules, such as daily frequency
    or weekly commitments.
15. Describe a concrete practice action and explain how it
    addresses the detected error.
16. Use second-person language ("you") rather than referring
    to "the player."
17. Do not repeat raw metric names such as "tempo_consistency";
    use natural language such as "tempo consistency."

18. The practice_candidates field contains approved instructional
    strategies linked to verified performance errors.

19. Use each practice candidate's method and progression to write
    a complete, musician-friendly exercise. The exercise must:
    - Refer to the specific measure.
    - Describe at least two concrete practice actions.
    - Explain how those actions address the detected error.
    - Describe how to progress after practicing successfully.

20. Never return internal strategy identifiers such as
    "reference_pitch_comparison", "passage_reconstruction",
    or "sequence_simplification" as exercise text.

    Do not copy the technique identifier into the exercise field.
    Convert the method and progression into complete sentences
    written directly to the musician.

21. Prefer specific exercises involving slow practice,
    metronome subdivisions, counting, listening, and
    gradual tempo increases when appropriate.

22. Do not invent an exact BPM. Only recommend a numerical
    starting tempo if verified tempo information is provided.

23. Recommend reference-audio playback only when the
    application confirms that reference audio is available.

24. If tempo_practice is provided, use its starting_bpm,
    increment_bpm, and score_bpm values when recommending
    metronome practice.

25. Explain how to progress from starting_bpm toward score_bpm.
    Increase the metronome only after the specified number
    of accurate repetitions.

26. Only use BPM values supplied by tempo_practice or
    intermediate values calculated using its increment_bpm.
    Never exceed score_bpm.

27. If tempo_practice is null, recommend slow practice
    without specifying numerical BPM values.

28. The error_type field is internal application metadata.
    Never mention "error_type" or reproduce its raw value
    inside overall_assessment or exercise text.

29. Write directly to the musician using "you" and "your".
    Never refer to "the player", "the musician", or
    "the user's ability" in the feedback.

30. Use natural musical language:
    - incorrect_pitch: wrong pitch or pitch accuracy
    - missing_note: missing note
    - additional_note: extra note
    - late_note: late note entry
    - early_note: early note entry
    - short_duration: note held too briefly
    - long_duration: note held too long

31. Every exercise must address its assigned error type.
    For incorrect_pitch, focus on comparing and correcting
    pitches, not on rhythm or note-entry timing.
    For missing_note, focus on including the omitted note.
    For additional_note, focus on eliminating extra notes.

32. Do not include explanatory sentences such as
    "This exercise targets the specific error_type..."
    or "This improves the player's ability..."
    Instead, explain the benefit naturally within the
    practice instructions.

33. The exercise field must contain only instructions
    intended for the musician, not explanations of the
    application's internal analysis.
Do not generate a next-session goal. The application calculates it.
"""


def format_practice_goal(plan):
    """Create a measurable goal aligned with prioritized practice errors."""
    selected_errors = plan.get("selected_errors") or []

    if selected_errors:
        error_types = {error["error_type"] for error in selected_errors}

        measures = sorted({
            error["measure"]
            for error in selected_errors
            if isinstance(error.get("measure"), int)
        })

        if measures:
            if len(measures) == 1:
                location = f"measure {measures[0]}"
            elif len(measures) == 2:
                location = f"measures {measures[0]} and {measures[1]}"
            else:
                measure_text = ", ".join(str(m) for m in measures[:-1])
                location = f"measures {measure_text}, and {measures[-1]}"
        else:
            location = "the affected passages"

        targets = []

        if "incorrect_pitch" in error_types:
            targets.append("correct pitches")

        if "missing_note" in error_types:
            targets.append("all expected notes")

        if "additional_note" in error_types:
            targets.append("no additional notes")

        if "early_note" in error_types or "late_note" in error_types:
            targets.append("accurate note timing")

        if "short_duration" in error_types or "long_duration" in error_types:
            targets.append("correct note durations")

        if targets:
            if len(targets) == 1:
                target_text = targets[0]
            else:
                target_text = ", ".join(targets[:-1]) + f", and {targets[-1]}"

            return (
                f"In your next practice session, play {location} "
                f"with {target_text} for three consecutive repetitions."
            )

    # Retain metric-based goals when no prioritized errors are available.
    goal = plan.get("suggested_goal")

    if goal is None:
        return (
            "Continue practicing and review your performance "
            "after the next session."
        )

    metric = goal["metric"].replace("_", " ")
    current = goal["current_percent"]
    target = goal["target_percent"]

    if current >= 100:
        return (
            f"Maintain {metric} at 100% "
            "in the next practice session."
        )

    return (
        f"Increase {metric} from {current:g}% "
        f"to at least {target:g}% in the next practice session."
    )


def validate_recommendations(feedback, plan):
    """Ensure recommended errors and measures exist in the analysis."""
    allowed = {
        (error["measure"], error["error_type"])
        for error in plan["selected_errors"]
    }

    if len(feedback.recommendations) > 3:
        raise ValueError("Too many practice recommendations.")

    invalid_exercises = {
        "reference_pitch_comparison",
        "passage_reconstruction",
        "sequence_simplification",
    }

    for recommendation in feedback.recommendations:
        exercise = recommendation.exercise.strip()

        forbidden_phrases = (
            "error_type",
            "the player",
            "player's ability",
            "the musician",
            "the user's ability",
            "this exercise targets",
        )

        if any(
            phrase in exercise.lower()
            for phrase in forbidden_phrases
        ):
            raise ValueError(
                "Exercise contains internal or third-person language."
            )

        if exercise.lower() in invalid_exercises:
            raise ValueError(
                "Exercise contains an internal strategy identifier."
            )

        if "_" in exercise and " " not in exercise:
            raise ValueError(
                "Exercise must contain natural-language instructions."
            )

        if len(exercise.split()) < 12:
            raise ValueError(
                "Exercise must provide detailed practice instructions."
            )

    if allowed and not feedback.recommendations:
        raise ValueError("No recommendations for detected errors.")

    for recommendation in feedback.recommendations:
        key = (
            recommendation.measure,
            recommendation.error_type,
        )

        if key not in allowed:
            raise ValueError(
                f"Unsupported recommendation: {key}"
            )


EXERCISE_TEMPLATES = {
    "late_note": (
        "Practice the affected beat slowly with a steady pulse. "
        "Repeat the passage while aligning each note onset with "
        "the beat to reduce late entries."
    ),
    "early_note": (
        "Count the beats aloud before playing the passage. "
        "Repeat it with a metronome and avoid entering "
        "before the expected beat."
    ),
    "incorrect_pitch": (
        "Isolate the affected note and compare it with a "
        "reliable pitch reference. Repeat the transition "
        "from the preceding note to improve pitch accuracy."
    ),
    "missing_note": (
        "Practice the affected passage slowly while counting "
        "each expected note. Gradually increase your speed "
        "once every note is consistently included."
    ),
    "additional_note": (
        "Practice the passage slowly while following the "
        "written note sequence. Remove unintended notes "
        "before increasing your playing speed."
    ),
    "short_duration": (
        "Count the full written duration of the affected note. "
        "Practice sustaining it for the correct number of beats."
    ),
    "long_duration": (
        "Practice releasing the affected note at its written "
        "duration. Use a steady pulse to avoid holding it "
        "longer than intended."
    ),
}


def generate_fallback_feedback(plan):
    """Create grounded practice feedback without an LLM."""
    errors = plan.get("selected_errors") or []
    recommendations = []
    seen = set()

    for error in errors:
        key = (error["measure"], error["error_type"])

        if key in seen:
            continue

        seen.add(key)

        exercise = EXERCISE_TEMPLATES.get(error["error_type"])

        if exercise is None:
            continue

        recommendations.append(
            PracticeRecommendation(
                measure=error["measure"],
                error_type=error["error_type"],
                exercise=exercise,
            )
        )

        if len(recommendations) == 3:
            break

    if errors:
        assessment = (
            "Your performance analysis identified areas "
            "that would benefit from targeted practice."
        )
    else:
        assessment = (
            "No note-level errors were detected in this "
            "performance. Continue practicing to maintain "
            "your consistency."
        )

    return AIPracticeFeedback(
        overall_assessment=assessment,
        recommendations=recommendations,
        next_session_goal=format_practice_goal(plan),
    )



def generate_ai_feedback(
    performance_summary: dict,
    model: str = OLLAMA_MODEL,
    score_summary: dict | None = None,
) -> AIPracticeFeedback:
    """Generate AI feedback, falling back when Ollama fails."""
    plan = build_feedback_plan(performance_summary, score_summary=score_summary)

    # A clean performance does not need LLM-generated exercises.
    if not plan["detected_errors"]:
        return generate_fallback_feedback(plan)

    allowed_errors = [
        {
            "measure": error["measure"],
            "error_type": error["error_type"],
        }
        for error in plan["selected_errors"]
    ]

    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        "MANDATORY RECOMMENDATIONS:\n"
        f"{json.dumps(allowed_errors, indent=2)}\n\n"
        "Generate exactly one recommendation for EACH combination "
        "listed above, in the same order. "
        "Do not select recommendations from detected_errors, "
        "error_counts, or problem_measures. "
        "Those fields are background information only. "
        "Do not recommend any error type that is not explicitly "
        "listed under MANDATORY RECOMMENDATIONS.\n\n"
        "Each recommendation must copy its measure and error_type "
        "exactly from the allowed combinations above. "
        "Do not change the measure number or error_type. "
        "Do not invent new combinations.\n\n"
        "VERIFIED PERFORMANCE DATA:\n"
        f"{json.dumps(plan, indent=2)}"
    )

    try:
        response = httpx.post(
            OLLAMA_URL,
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "format": AIPracticeFeedback.model_json_schema(),
                "options": {"temperature": 0.1},
            },
            timeout=90.0,
        )

        response.raise_for_status()

        result = response.json()

        feedback = AIPracticeFeedback.model_validate_json(
            result["response"]
        )

        # Python determines which errors are eligible for feedback.
        allowed_keys = {
            (error["measure"], error["error_type"])
            for error in allowed_errors
        }

        # Keep only recommendations matching verified errors.
        filtered_recommendations = [
            recommendation
            for recommendation in feedback.recommendations
            if (recommendation.measure, recommendation.error_type)
            in allowed_keys
        ]

        # Every selected error must have exactly one recommendation.
        returned_keys = [
            (recommendation.measure, recommendation.error_type)
            for recommendation in filtered_recommendations
        ]

        if (
            len(returned_keys) != len(allowed_keys)
            or set(returned_keys) != allowed_keys
        ):
            raise ValueError(
                "Ollama did not provide exactly one recommendation "
                "for each selected error."
            )

        # Preserve the order chosen by the deterministic planner.
        recommendations_by_key = {
            (recommendation.measure, recommendation.error_type):
            recommendation
            for recommendation in filtered_recommendations
        }

        feedback.recommendations = [
            recommendations_by_key[
                (error["measure"], error["error_type"])
            ]
            for error in allowed_errors
        ]

        validate_recommendations(feedback, plan)

        # Generate the assessment after filtering the recommendations.
        recommendation_count = len(feedback.recommendations)

        if recommendation_count == 1:
            feedback.overall_assessment = (
                "Your performance analysis identified an area "
                "for improvement. Here is a targeted practice "
                "exercise to help you improve."
            )
        else:
            feedback.overall_assessment = (
                "Your performance analysis identified areas "
                "for improvement. Here are "
                f"{recommendation_count} targeted practice "
                "exercises to help you improve."
            )

        feedback.next_session_goal = format_practice_goal(plan)

        return feedback

    except (
        httpx.RequestError,
        httpx.HTTPStatusError,
        ValidationError,
        ValueError,
        KeyError,
        TypeError,
    ) as exc:
        logger.warning(
            "Ollama feedback generation failed; using fallback. "
            "Error type: %s. Details: %s",
            type(exc).__name__,
            exc,
        )
        return generate_fallback_feedback(plan)

