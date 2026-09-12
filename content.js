(function() {
  let currentMode = window.localStorage.getItem('quiz_helper_mode') || "off";
  let fastComplete = window.localStorage.getItem('fast_complete') === 'true';
  let lastQuestionContent = "";

  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "FROM_EXTENSION") {
      if (event.data.mode !== undefined) {
        currentMode = event.data.mode;
        window.localStorage.setItem('quiz_helper_mode', currentMode);
        if (currentMode === "off") {
          clearHighlights();
        } else {
          scanAndHighlight();
        }
      }
      if (event.data.fastComplete !== undefined) {
        fastComplete = event.data.fastComplete;
        window.localStorage.setItem('fast_complete', fastComplete);
      }
    }
  });

  function clearHighlights() {
    document.querySelectorAll('button, .chakra-button').forEach(btn => {
      btn.style.removeProperty("outline");
      btn.style.removeProperty("outline-offset");
      btn.style.removeProperty("box-shadow");
      btn.style.removeProperty("background");
      btn.style.removeProperty("background-color");

      btn.querySelectorAll('*').forEach(child => {
        child.style.removeProperty("color");
        child.style.removeProperty("text-shadow");
      });
    });

    const textInput = document.querySelector('input[type="text"], input:not([type="checkbox"]):not([type="radio"]), textarea');
    if (textInput) textInput.placeholder = "";
  }

  function extractStrings(obj) {
    let strings = [];
    if (!obj) return strings;
    if (typeof obj === 'string') return [obj];
    if (typeof obj === 'object') {
      for (const key in obj) {
        strings = strings.concat(extractStrings(obj[key]));
      }
    }
    return strings;
  }

  function getQuizOptionsFromDOM() {
    const answerEl = document.querySelector('.css-i86xm7, [data-testid="question-answer"]');
    if (!answerEl) return null;

    const btn = answerEl.closest('button');
    if (!btn) return null;

    const key = Object.keys(btn).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (!key) return null;

    let fiber = btn[key];
    while (fiber) {
      const props = fiber.memoizedProps || fiber.pendingProps;
      if (props && props.options && Array.isArray(props.options)) {
        return props.options;
      }
      fiber = fiber.return;
    }
    return null;
  }

  function scanAndHighlight() {
    if (currentMode !== "highlight") return;

    const options = getQuizOptionsFromDOM();
    if (!options) return;

    const answerNodes = document.querySelectorAll('.css-i86xm7, [data-testid="question-answer"]');

    answerNodes.forEach((node) => {
      const button = node.closest('button');
      if (!button) return;

      const nodeText = node.textContent.trim();

      const matchingOption = options.find(opt => {
        if (!opt) return false;
        const allPossibleTexts = extractStrings(opt.text);
        return allPossibleTexts.some(txt => typeof txt === 'string' && txt.trim() === nodeText);
      });

      if (!matchingOption) return;

      const isCorrect = matchingOption.isCorrect === true || 
                        matchingOption.correct === true || 
                        matchingOption.correct === 1;

      if (isCorrect) {
        button.style.setProperty("outline", "5px solid #76ff03", "important");
        button.style.setProperty("outline-offset", "-5px", "important");
        button.style.setProperty("background-color", "rgb(0, 200, 83)", "important");
        button.style.setProperty("background", "rgb(0, 200, 83)", "important");
        button.style.setProperty("box-shadow", "0 0 20px rgba(118, 255, 3, 0.8)", "important");

        button.querySelectorAll('*').forEach(child => {
          child.style.setProperty("color", "#ffffff", "important");
          child.style.setProperty("text-shadow", "0 1px 4px rgba(0,0,0,0.9)", "important");
        });
      } else {
        button.style.removeProperty("outline");
        button.style.removeProperty("outline-offset");
        button.style.removeProperty("box-shadow");
        button.style.removeProperty("background");
        button.style.removeProperty("background-color");

        button.querySelectorAll('*').forEach(child => {
          child.style.removeProperty("color");
          child.style.removeProperty("text-shadow");
        });
      }
    });

    const correctOption = options.find(opt => opt && (opt.isCorrect === true || opt.correct === true || opt.correct === 1));
    if (correctOption) {
      const allTexts = extractStrings(correctOption.text);
      const textInput = document.querySelector('input[type="text"], input:not([type="checkbox"]):not([type="radio"]), textarea');
      if (textInput && allTexts.length > 0) {
        textInput.placeholder = allTexts[0];
      }
    }
  }

  function initWatcher() {
    setInterval(() => {
      if (currentMode !== "highlight") return;

      const answerNodes = document.querySelectorAll('.css-i86xm7, [data-testid="question-answer"]');
      let currentContent = "";
      answerNodes.forEach(node => {
        currentContent += node.textContent.trim();
      });

      if (currentContent !== lastQuestionContent) {
        lastQuestionContent = currentContent;
        clearHighlights();
        scanAndHighlight();
      }
    }, 50);
  }

  // --- AUTOMATION ENGINE ---

  function getAuthToken() {
    const cookieMatch = document.cookie.match(/(?:eu-central-1__[a-f0-9]+)/i);
    if (cookieMatch) return cookieMatch[0];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key);
      if (typeof val === 'string' && val.includes('eu-central-1__')) {
        const match = val.match(/eu-central-1__[a-f0-9]+/i);
        if (match) return match[0];
      }
    }

    return localStorage.getItem('token') || 
           localStorage.getItem('auth_token') || 
           sessionStorage.getItem('token');
  }

  function getReactFiber(element) {
    if (!element) return null;
    const key = Object.keys(element).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    return key ? element[key] : null;
  }

  function extractTaskAndAssignment(element) {
    let fiber = getReactFiber(element);
    let taskId = null;
    let assignmentId = null;
    let subjectId = 423;
    let gradeId = 177;

    while (fiber) {
      const props = fiber.memoizedProps;
      if (props) {
        if (!taskId) {
          const taskObj = props.task || props.lesson || props.item;
          if (taskObj) {
            taskId = taskObj.task_id || taskObj.id;
            if (taskObj.subject_id) subjectId = taskObj.subject_id;
            if (taskObj.grade_id) gradeId = taskObj.grade_id;
          }
        }
        if (!assignmentId) {
          const assignObj = props.assignment || props.assignmentId;
          if (assignObj) {
            assignmentId = typeof assignObj === 'object' ? assignObj.id : assignObj;
          }
        }
      }
      fiber = fiber.return;
    }

    return {
      taskId: taskId ? parseInt(taskId, 10) : null,
      assignmentId: assignmentId ? parseInt(assignmentId, 10) : null,
      subjectId: parseInt(subjectId, 10) || 423,
      gradeId: parseInt(gradeId, 10) || 177
    };
  }

  async function fetchQuizQuestions(lessonCode, token) {
    try {
      const res = await fetch(`https://content.binogi.net/api/legacy/lessons/${lessonCode}`, {
        headers: {
          "accept": "application/json, text/plain, */*",
          "authorization": token,
          "Referer": "https://binogi.com/"
        }
      });
      if (!res.ok) return {};

      const data = await res.json();
      const questions = data?.quiz?.questions || [];
      const levelsData = { 1: [], 2: [], 3: [] };

      questions.forEach((q) => {
        const lvl = q.level;
        const qid = q.qid;
        if (!levelsData[lvl] || !qid) return;

        const options = q.options || [];
        let correctOpt = options.find(opt => opt.isCorrect) || options[0];
        const oid = correctOpt ? correctOpt.oid : null;

        if (oid) {
          levelsData[lvl].push({
            question_uuid: qid,
            selected_answer_uuid: oid
          });
        }
      });

      return levelsData;
    } catch {
      return {};
    }
  }

  function initAutoCompleter() {
    setInterval(() => {
      if (!fastComplete) {
        document.querySelectorAll('[data-auto-hooked]').forEach(el => {
          el.removeAttribute('data-auto-hooked');
        });
        return;
      }

      const thumbnails = document.querySelectorAll('div.css-ktqdlo:not([data-auto-hooked]), div.css-1dsy9jz:not([data-auto-hooked])');

      thumbnails.forEach((thumb) => {
        const row = thumb.closest('div.css-z6h8lq, div.css-17ikkdj');
        if (!row) return;

        const hasCheckmark = !!row.querySelector('img[alt="Bock-ikon"]');
        if (hasCheckmark) return;

        const isVideo = !!row.querySelector('img[alt="Videoikon"]') || row.textContent.includes('Video');
        const isQuiz = !!row.querySelector('img[alt="Quiz-ikon"]') || row.textContent.includes('Quiz');

        if (!isVideo && !isQuiz) return;

        thumb.setAttribute('data-auto-hooked', 'true');

        thumb.addEventListener('click', async (e) => {
          if (!fastComplete) return;

          e.stopPropagation();

          const imgEl = thumb.querySelector('img[src*="thumbs_small/"]');
          let lessonCode = "";
          if (imgEl) {
            const match = imgEl.src.match(/thumbs_small\/([A-Za-z0-9]+)\.png/);
            if (match && match[1]) {
              lessonCode = match[1];
            }
          }

          const { taskId, assignmentId, subjectId, gradeId } = extractTaskAndAssignment(row);
          const token = getAuthToken();

          if (!token) return;

          if (isVideo) {
            const payload = {
              activity_type_id: 1,
              lesson_code: lessonCode,
              activity_data: {
                subtitle_language: "",
                audio_language: "sv",
                assignment_id: assignmentId,
                task_id: taskId,
                localization: "SE_sv",
                subject_id: subjectId
              }
            };

            try {
              await fetch("https://useractivity.binogi.net/api/activity", {
                method: "POST",
                headers: {
                  "accept": "application/json",
                  "authorization": token,
                  "content-type": "application/json",
                  "Referer": "https://binogi.com/"
                },
                body: JSON.stringify(payload)
              });
            } catch {}

          } else if (isQuiz) {
            const levelsData = await fetchQuizQuestions(lessonCode, token);

            for (let level = 1; level <= 3; level++) {
              const qas = levelsData[level] || [];
              const questionsCorrect = qas.map(qa => qa.question_uuid);

              if (questionsCorrect.length === 0) continue;

              const payload = {
                activity_type_id: 2,
                lesson_code: lessonCode,
                activity_data: {
                  quiz_level: level,
                  questions_correct: questionsCorrect,
                  questions_incorrect: [],
                  question_answers: qas,
                  grade_id: gradeId,
                  subject_id: subjectId,
                  text_language: "sv",
                  assignment_id: assignmentId,
                  task_id: taskId
                }
              };

              try {
                await fetch("https://useractivity.binogi.net/api/activity", {
                  method: "POST",
                  headers: {
                    "accept": "application/json",
                    "authorization": token,
                    "content-type": "application/json",
                    "Referer": "https://binogi.com/"
                  },
                  body: JSON.stringify(payload)
                });
              } catch {}
            }
          }
        });
      });
    }, 1000);
  }

  initWatcher();
  initAutoCompleter();
})();