from music_analysis.pitch_utils import pitch_distance


def align_notes(expected, performed):
    """
    Align an expected note sequence with a performed note sequence.

    Returns a list describing how each note was aligned.

    Possible operations:
        match       - correct note
        substitution - incorrect pitch
        deletion    - expected note was skipped
        insertion   - extra note was performed
    """

    n = len(expected)
    m = len(performed)

    # Cost for skipping or adding a note
    gap_cost = 2

    # Create the dynamic programming table
    dp = [[0] * (m + 1) for _ in range(n + 1)]

    # Track which operation produced each cell
    path = [[None] * (m + 1) for _ in range(n + 1)]

    # Initialize first column
    for i in range(1, n + 1):
        dp[i][0] = i * gap_cost
        path[i][0] = "deletion"

    # Initialize first row
    for j in range(1, m + 1):
        dp[0][j] = j * gap_cost
        path[0][j] = "insertion"

    # Fill the dynamic programming table
    for i in range(1, n + 1):
        for j in range(1, m + 1):

            pitch_cost = pitch_distance(
                expected[i - 1],
                performed[j - 1]
            )

            substitution_cost = dp[i - 1][j - 1] + pitch_cost
            deletion_cost = dp[i - 1][j] + gap_cost
            insertion_cost = dp[i][j - 1] + gap_cost

            best_cost = min(
                substitution_cost,
                deletion_cost,
                insertion_cost
            )

            dp[i][j] = best_cost

            if best_cost == substitution_cost:
                path[i][j] = "match" if pitch_cost == 0 else "substitution"

            elif best_cost == deletion_cost:
                path[i][j] = "deletion"

            else:
                path[i][j] = "insertion"

    # Backtrack through the table to recover the alignment
    alignment = []

    i = n
    j = m

    while i > 0 or j > 0:

        operation = path[i][j]

        if operation in ("match", "substitution"):
            alignment.append({
                "expected_note": expected[i - 1],
                "performed_note": performed[j - 1],
                "operation": operation
            })

            i -= 1
            j -= 1

        elif operation == "deletion":
            alignment.append({
                "expected_note": expected[i - 1],
                "performed_note": None,
                "operation": "deletion"
            })

            i -= 1

        elif operation == "insertion":
            alignment.append({
                "expected_note": None,
                "performed_note": performed[j - 1],
                "operation": "insertion"
            })

            j -= 1

    # Backtracking creates the sequence backwards
    alignment.reverse()

    return alignment