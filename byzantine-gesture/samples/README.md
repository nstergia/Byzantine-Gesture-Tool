# Sample recordings

Recordings of the same excerpt of «Κύριε, ἐκέκραξα» (about 11 s) for trying the tool, for reproducing
the examples of Section 3.1 of the paper and for the comparison with pYIN of Section 3.2
(`bench/pyin_compare.py`). The teacher and students B and C gave written consent to their publication;
faces are blurred frame by frame (in `student_C.mp4` the background is also darkened), while the hands
are kept sharp wherever they do not cross the centre of the face. In `student_B.mp4` the face is
blurred only in part, so that the hand stays visible; student B approved this version. Takes 1 and 2 are published as audio
only.

In the paper, student C was recorded in two sessions: three takes recorded in the tool in October
(session 1; take 3 is the take of Fig. 3) and five takes recorded at home in November (session 2).
Student B (male voice) was recorded once.

| File | Content | Paper |
|---|---|---|
| `teacher.mp4` | Teacher (expert chanter), 1280 × 720, 25 fps, original audio | reference in all examples |
| `student_C_s1_take1_audio.webm` | Student C, session 1, take 1, audio only (Opus, as recorded) | Table 6 |
| `student_C_s1_take2_audio.webm` | Student C, session 1, take 2, audio only (Opus, as recorded) | Table 6 |
| `student_take.mp4` | Student C, session 1, take 3, recorded in the tool, 640 × 480, 25 fps | Fig. 3, Tables 5 and 6 |
| `student_B.mp4` | Student B, the take of the paper, 1280 × 720, 25 fps | Tables 5 and 6 |
| `student_C.mp4` | Student C, session 2, take 5, 1280 × 720, 25 fps | Tables 5 and 6 |

**Try it**
1. Start the tool (see the main README) and load `teacher.mp4` as the teacher video.
2. On the student side choose **VIDEO** and load `student_take.mp4`, `student_B.mp4` or `student_C.mp4`.
3. Play the teacher video once, so that its guide is stored.
4. Drag both bars to the same musical point (for example the first sung note) and press **LOCK HERE**,
   then turn on the **TIME LINK** and play.
5. Open **EVALUATION** at the end; **EXPORT DATA (CSV)** saves the scored windows and frames.

**What to expect.** Share in the exact band for each single take. Table 5 of the paper gives, for
session 2, the median over all five takes, of which only take 5 is public, so it differs from the
values below. A run on your computer will differ by a few points, depending on where you lock and on
how many frames the hand tracker processes; on a busy computer the first playback may stall, and a
second or third run is usually enough.

| Student file | Hand | Voice | Voice, offset removed | Mean signed voice deviation |
|---|---|---|---|---|
| `student_take.mp4` (C, session 1, take 3) | 91% | 49% | 82% | about −46 cents (flat) |
| `student_B.mp4` (B) | 91–94% | 75–86% | 79–89% | – |
| `student_C.mp4` (C, session 2, take 5) | 93–98% | 63–70% | 74–78% | about −30 cents (flat) |

For `student_B.mp4` the ranges are those of Table 5 (four analyses of the original, unblurred
video; the blur does not touch the hand and the audio is only re-encoded). For `student_C.mp4` the range covers two analyses; the upper values came from a lock with the teacher
at 1.0 s and the student at 1.2 s (OFFSET +0.24 s in the time bar).

**pYIN comparison (Table 6).** Rows for the public files are reproduced by
`python3 bench/pyin_compare.py samples/teacher.mp4 samples/student_C_s1_take1_audio.webm samples/student_C_s1_take2_audio.webm samples/student_take.mp4 samples/student_B.mp4 samples/student_C.mp4`.

The student sings an octave above the teacher; the voice is compared independently of octave.
The recordings may be used for research and teaching with the software; please do not redistribute
them separately.
