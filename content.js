(function() {
  let currentMode = window.localStorage.getItem('quiz_helper_mode') || "off";
  let fastComplete = window.localStorage.getItem('fast_complete') === 'true';
  let lastQuestionContent = "";

  console.log("[Quiz Helper] Script loaded. Current mode:", currentMode);

  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "FROM_EXTENSION") {
      if (event.data.mode !== undefined) {
        currentMode = event.data.mode;
        window.localStorage.setItem('quiz_helper_mode', currentMode);
        console.log("[Quiz Helper] Mode updated to:", currentMode);
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

    const key = Object.keys(btn).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$'));
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

  function initVideoHook() {
    setInterval(() => {
      document.querySelectorAll('i.fa:not([data-hooked])').forEach(icon => {
        const text = icon.parentElement?.textContent || '';
        if (text.includes('Titta på film') || text.includes('Video')) {
          icon.setAttribute('data-hooked', 'true');
          icon.addEventListener('click', () => {
            if (!fastComplete) return;

            icon.removeAttribute('ng-class');
            icon.classList.remove('fa-square-o');
            icon.classList.add('fa-check-square-o');

            const container = icon.closest('.to-do');
            if (container) {
              container.removeAttribute('ng-class');
              container.classList.add('completed');
            }

            const root = document.querySelector('[ng-app]') || document.body;
            if (!window.angular) return;
            const injector = window.angular.element(root).injector();
            if (!injector) return;

            const headers = injector.get('$http').defaults.headers;
            const token = headers.post?.Authorization || headers.post?.authorization || headers.common?.Authorization || headers.Authorization;

            const ctrl = Array.from(document.querySelectorAll('*'))
              .map(element => window.angular.element(element).controller())
              .find(instance => instance?.playerContentFactory);

            if (!ctrl || !token) return;

            const lessonId = ctrl.playerContentFactory.lesson.id;
            const subjectId = ctrl.playerContentFactory.lesson.default_subject_id;

            fetch("https://api.binogi.se/lessons/videoReport", {
              method: "POST",
              headers: {
                "Authorization": token,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                lesson_id: lessonId,
                watched_seconds: 5,
                subject_id: subjectId
              })
            });
          }, { once: true });
        }
      });
    }, 1000);
  }

  function initQuizHook() {
    setInterval(() => {
      document.querySelectorAll('i.fa:not([data-quiz-hooked])').forEach(icon => {
        const text = icon.parentElement?.textContent || '';
        if (text.includes('Gör quiz') || text.includes('Quiz')) {
          icon.setAttribute('data-quiz-hooked', 'true');
          icon.addEventListener('click', () => {
            if (!fastComplete) return;

            icon.removeAttribute('ng-class');
            icon.classList.remove('fa-square-o');
            icon.classList.add('fa-check-square-o');

            const container = icon.closest('.to-do');
            if (container) {
              container.removeAttribute('ng-class');
              container.classList.add('completed');
            }

            const root = document.querySelector('[ng-app]') || document.body;
            if (!window.angular) return;
            const injector = window.angular.element(root).injector();
            if (!injector) return;

            const headers = injector.get('$http').defaults.headers;
            const token = headers.post?.Authorization || headers.post?.authorization || headers.common?.Authorization || headers.Authorization;

            const ctrl = Array.from(document.querySelectorAll('*'))
              .map(element => window.angular.element(element).controller())
              .find(instance => instance?.playerContentFactory);

            if (!ctrl || !token) return;

            const lessonCode = ctrl.conceptsFactory?.id || ctrl.playerContentFactory?.lesson?.code;
            const subjectId = ctrl.playerContentFactory.lesson.default_subject_id;

            for (let level = 1; level <= 3; level++) {
              fetch("https://api.binogi.se/lessons/quizReport", {
                method: "POST",
                headers: {
                  "Authorization": token,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  level: level,
                  lesson_code: lessonCode,
                  result: [
                    {
                      question_uuid: "00000000-0000-4000-8000-000000000000",
                      result: true,
                      language_code: "sv",
                      answer_timestamp: Math.floor(Date.now() / 1000)
                    }
                  ],
                  subject_id: subjectId,
                  passed: true
                })
              });
            }
          }, { once: true });
        }
      });
    }, 1000);
  }

  initWatcher();
  initVideoHook();
  initQuizHook();
})();