# Sample recordings

Three short recordings of the same excerpt of «Κύριε, ἐκέκραξα» (about 11 s), for trying the tool, for
reproducing examples of Section 3.1 of the paper and for the comparison with pYIN
(`bench/pyin_compare.py`). All three people gave written consent to their publication; faces are
blurred frame by frame (in `student_C.mp4` the background is also darkened), while the hands are kept
sharp wherever they do not cross the centre of the face.

| File | Content |
|---|---|
| `teacher.mp4` | Teacher (expert chanter), 1280 × 720, 25 fps, original audio |
| `student_take.mp4` | Student A, take 3 (the take of Fig. 3), recorded in the tool, 640 × 480, 25 fps |
| `student_C.mp4` | Student C, take 5, 1280 × 720, 25 fps |

**Try it**
1. Start the tool (see the main README) and load `teacher.mp4` as the teacher video.
2. On the student side choose **VIDEO** and load one of the student files.
3. Play the teacher video once, so that its guide is stored.
4. Drag both bars to the same musical point (for example the first sung note) and press **LOCK HERE**,
   then turn on the **TIME LINK** and play.
5. Open **EVALUATION** at the end; **EXPORT DATA (CSV)** saves the scored windows and frames.

**What to expect.** Share in the exact band; for C, the range of two analyses with slightly different locks. A run on your
computer will differ by a few points, depending on where you lock and on how many frames the hand
tracker processes.

| Student file | Hand | Voice | Voice, offset removed | Mean signed voice deviation |
|---|---|---|---|---|
| `student_take.mp4` (A) | 91% | 49% | 82% | about −46 cents (flat) |
| `student_C.mp4` (C) | 93–98% | 63–70% | 74–78% | about −30 cents (flat) |

For `student_C.mp4`, the upper values came from a lock with the teacher at 1.0 s and the student at
1.2 s (OFFSET +0.24 s in the time bar); entering the same offset with the ±0.05 / ±0.25 buttons should
reproduce them closely.

Both students sing an octave above the teacher; the voice is compared independently of octave.
The recordings may be used for research and teaching with the software; please do not redistribute
them separately.
