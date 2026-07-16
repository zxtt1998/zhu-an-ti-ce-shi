(function () {
  const bank = window.QUESTION_BANK;
  const flatQuestions = bank.flatMap((chapter) =>
    chapter.sections.flatMap((section) =>
      section.questions.map((question) => ({
        ...question,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        sectionId: section.id,
        sectionTitle: section.title
      }))
    )
  );

  const storeKey = "zhuAnSafetyTechPractice";
  const saved = JSON.parse(localStorage.getItem(storeKey) || "{}");

  const state = {
    mode: saved.mode || "practice",
    chapterId: saved.chapterId || bank[0].id,
    sectionId: saved.sectionId || bank[0].sections[0].id,
    questionIndex: saved.questionIndex || 0,
    selected: [],
    revealed: false,
    answerMode: saved.answerMode || "instant",
    batchScope: saved.batchScope || "section",
    pendingAnswers: saved.pendingAnswers || {},
    review: saved.review || null,
    answers: saved.answers || {},
    notes: saved.notes || {},
    flagged: saved.flagged || {},
    favorites: saved.favorites || {},
    exam: saved.exam || null,
    exportMessage: ""
  };

  const app = document.querySelector("#app");

  function persist() {
    localStorage.setItem(
      storeKey,
      JSON.stringify({
        mode: state.mode,
        chapterId: state.chapterId,
        sectionId: state.sectionId,
        questionIndex: state.questionIndex,
        answerMode: state.answerMode,
        batchScope: state.batchScope,
        pendingAnswers: state.pendingAnswers,
        review: state.review,
        answers: state.answers,
        notes: state.notes,
        flagged: state.flagged,
        favorites: state.favorites,
        exam: state.exam
      })
    );
  }

  function icon(name) {
    const icons = {
      book: '<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H7a3 3 0 0 0-3 3V5.5Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/></svg>',
      x: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
      test: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
      star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
      flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4h11l1 4h-9v7h11l-1-4"/></svg>',
      check: '<svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6"/></svg>',
      alert: '<svg viewBox="0 0 24 24"><path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5M12 17h.01"/></svg>',
      reset: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8"/><path d="M4 4v4h4"/></svg>',
      play: '<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></svg>'
    };
    return icons[name] || "";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function arraysEqual(a, b) {
    return a.length === b.length && [...a].sort().every((item, index) => item === [...b].sort()[index]);
  }

  function currentChapter() {
    return bank.find((chapter) => chapter.id === state.chapterId) || bank[0];
  }

  function currentSection() {
    const chapter = currentChapter();
    return chapter.sections.find((section) => section.id === state.sectionId) || chapter.sections[0];
  }

  function practiceQuestions() {
    if (state.mode === "wrong") {
      const wrong = flatQuestions.filter((question) => {
        const record = state.answers[question.id];
        return record && !record.correct;
      });
      return wrong.length ? wrong : flatQuestions.filter((question) => state.flagged[question.id]);
    }
    if (state.answerMode === "batch" && state.batchScope === "chapter") {
      return currentChapter().sections.flatMap((section) =>
        section.questions.map((question) => ({
          ...question,
          chapterTitle: currentChapter().title,
          sectionTitle: section.title
        }))
      );
    }
    return currentSection().questions.map((question) => ({
      ...question,
      chapterTitle: currentChapter().title,
      sectionTitle: currentSection().title
    }));
  }

  function visibleSelected(question, record) {
    if (state.selected.length) return state.selected;
    if (state.answerMode === "batch" && state.pendingAnswers[question.id]) return state.pendingAnswers[question.id];
    return record?.selected || [];
  }

  function reviewQuestions() {
    return (state.review?.ids || []).map((id) => flatQuestions.find((question) => question.id === id)).filter(Boolean);
  }

  function wrongQuestionsAll() {
    return flatQuestions.filter((question) => state.answers[question.id] && !state.answers[question.id].correct);
  }

  function activeBatchTitle() {
    return state.batchScope === "chapter" ? currentChapter().title : currentSection().title;
  }

  function currentQuestion() {
    const questions = practiceQuestions();
    return questions[Math.min(state.questionIndex, Math.max(questions.length - 1, 0))];
  }

  function answeredCount(section) {
    return section.questions.filter((question) => state.answers[question.id]).length;
  }

  function stats() {
    const answered = flatQuestions.filter((question) => state.answers[question.id]);
    const correct = answered.filter((question) => state.answers[question.id].correct).length;
    const wrong = answered.length - correct;
    const accuracy = answered.length ? Math.round((correct / answered.length) * 100) : 0;
    const weak = Object.entries(
      answered.reduce((acc, question) => {
        const key = question.sectionTitle;
        acc[key] ||= { total: 0, wrong: 0 };
        acc[key].total += 1;
        if (!state.answers[question.id].correct) acc[key].wrong += 1;
        return acc;
      }, {})
    )
      .map(([name, value]) => ({
        name,
        rate: value.total ? Math.round((value.wrong / value.total) * 100) : 0
      }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);
    return { answered: answered.length, correct, wrong, accuracy, weak };
  }

  function render() {
    const s = stats();
    app.innerHTML = `
      <div class="shell">
        <header class="topbar">
          <div class="brand">
            <div class="brand-mark">安</div>
            <div>
              <h1>注册安全工程师刷题</h1>
              <p>安全生产技术基础 · 教材扫描版题库</p>
            </div>
          </div>
          <nav class="mode-tabs">
            ${modeButton("practice", "book", "章节练习")}
            ${modeButton("wrong", "x", "错题强化")}
            ${modeButton("exam", "test", "模拟考试")}
          </nav>
          <button class="icon-button" data-action="reset" title="清空本地练习记录">${icon("reset")}</button>
        </header>
        <main class="layout">
          ${renderSidebar(s)}
          ${state.mode === "exam" ? renderExam() : state.review ? renderReview() : renderPractice()}
          ${renderDashboard(s)}
        </main>
      </div>
    `;
    bindEvents();
  }

  function modeButton(mode, iconName, label) {
    return `<button class="mode-tab ${state.mode === mode ? "active" : ""}" data-mode="${mode}">${icon(iconName)}<span>${label}</span></button>`;
  }

  function renderSidebar(s) {
    const total = flatQuestions.length;
    return `
      <aside class="sidebar">
        <div class="panel-head">
          <strong>章节目录</strong>
          <span>总进度 ${Math.round((s.answered / total) * 100)}%</span>
        </div>
        <div class="meter"><i style="width:${(s.answered / total) * 100}%"></i></div>
        <div class="chapter-list">
          ${bank
            .map((chapter) => {
              const chapterTotal = chapter.sections.reduce((sum, section) => sum + section.questions.length, 0);
              const chapterDone = chapter.sections.reduce((sum, section) => sum + answeredCount(section), 0);
              return `
                <section class="chapter ${chapter.id === state.chapterId ? "open" : ""}">
                  <button class="chapter-title" data-chapter="${chapter.id}" data-section="${chapter.sections[0].id}">
                    <span>${escapeHtml(chapter.title)}</span>
                    <b>${chapterDone}/${chapterTotal}</b>
                  </button>
                  <div class="section-list">
                    ${chapter.sections
                      .map(
                        (section) => `
                          <button class="section-link ${section.id === state.sectionId && state.mode === "practice" ? "active" : ""}" data-chapter="${chapter.id}" data-section="${section.id}">
                            <span>${escapeHtml(section.title)}</span>
                            <b>${answeredCount(section)}/${section.questions.length}</b>
                          </button>
                        `
                      )
                      .join("")}
                  </div>
                </section>
              `;
            })
            .join("")}
        </div>
        <div class="source-note">
          <strong>教材来源</strong>
          <span>《安全生产技术基础（2026）》共 352 页。原 PDF 为图片扫描版，当前题库按目录考点和常见考试知识点整理。</span>
        </div>
      </aside>
    `;
  }

  function renderPractice() {
    const questions = practiceQuestions();
    if (!questions.length) {
      return `
        <section class="workspace empty">
          <div class="empty-state">
            <h2>还没有错题</h2>
            <p>先完成章节练习，系统会自动把答错的题放进错题强化。</p>
            <button class="primary" data-mode="practice">${icon("book")} 开始章节练习</button>
          </div>
        </section>
      `;
    }
    if (state.questionIndex >= questions.length) state.questionIndex = 0;
    const question = currentQuestion();
    const record = state.answers[question.id];
    const selected = visibleSelected(question, record);
    const revealed = state.answerMode === "instant" && (state.revealed || Boolean(record));
    const correct = arraysEqual(selected, question.answer);
    const isMultiple = question.type === "multiple";
    const batchDone = questions.filter((item) => state.pendingAnswers[item.id]?.length).length;
    const isBatch = state.mode === "practice" && state.answerMode === "batch";

    return `
      <section class="workspace">
        <div class="question-head">
          <div>
            <p>${escapeHtml(question.chapterTitle)} / ${escapeHtml(question.sectionTitle)}</p>
            <h2>${escapeHtml(question.point)}</h2>
          </div>
          <div class="question-tools">
            <button class="tool ${state.favorites[question.id] ? "on" : ""}" data-action="favorite" title="收藏">${icon("star")}</button>
            <button class="tool ${state.flagged[question.id] ? "on warn" : ""}" data-action="flag" title="标记">${icon("flag")}</button>
          </div>
        </div>
        <div class="question-meta">
          <span>${isMultiple ? "多选题" : "单选题"}</span>
          <b>第 ${state.questionIndex + 1} 题 / 共 ${questions.length} 题</b>
        </div>
        ${state.mode === "practice" ? renderAnswerSettings(batchDone, questions.length) : ""}
        <article class="question-card">
          <h3>${state.questionIndex + 1}. ${escapeHtml(question.stem)}</h3>
          <div class="options">
            ${question.options
              .map((option, index) => {
                const picked = selected.includes(index);
                const answer = question.answer.includes(index);
                const className = [
                  "option",
                  picked ? "picked" : "",
                  revealed && answer ? "answer" : "",
                  revealed && picked && !answer ? "wrong" : ""
                ]
                  .filter(Boolean)
                  .join(" ");
                return `
                  <button class="${className}" data-option="${index}" ${revealed ? "disabled" : ""}>
                    <b>${String.fromCharCode(65 + index)}</b>
                    <span>${escapeHtml(option)}</span>
                    ${revealed && answer ? icon("check") : ""}
                  </button>
                `;
              })
              .join("")}
          </div>
          ${
            revealed
              ? `<div class="answer-box ${correct ? "right" : "miss"}">
                  <div class="answer-line">
                    <span>正确答案：<b>${question.answer.map((i) => String.fromCharCode(65 + i)).join("、")}</b></span>
                    <span>你的答案：<b>${selected.length ? selected.map((i) => String.fromCharCode(65 + i)).join("、") : "未作答"}</b></span>
                    <strong>${correct ? icon("check") + " 回答正确" : icon("alert") + " 需要回炉"}</strong>
                  </div>
                  <p><b>解析：</b>${escapeHtml(question.explanation)}</p>
                  <p><b>考点：</b>${escapeHtml(question.point)}</p>
                </div>`
              : ""
          }
          <div class="note-box">
            <label for="note-${question.id}">本题笔记</label>
            <textarea id="note-${question.id}" data-note="${question.id}" rows="4" placeholder="记录易错点、口诀或教材页码">${escapeHtml(state.notes[question.id] || "")}</textarea>
          </div>
        </article>
        <div class="actions">
          <button class="secondary" data-action="prev">上一题</button>
          ${
            isBatch
              ? `<button class="primary" data-action="${state.questionIndex === questions.length - 1 ? "submit-batch" : "save-next"}" ${selected.length ? "" : "disabled"}>${state.questionIndex === questions.length - 1 ? "交卷对答案" : "保存并下一题"}</button>`
              : revealed
              ? `<button class="primary" data-action="next">下一题</button>`
              : `<button class="primary" data-action="reveal" ${selected.length ? "" : "disabled"}>${isMultiple ? "提交答案" : "查看解析"}</button>`
          }
        </div>
      </section>
    `;
  }

  function renderAnswerSettings(done, total) {
    return `
      <div class="answer-settings">
        <div class="segmented" aria-label="判题方式">
          <button class="${state.answerMode === "instant" ? "active" : ""}" data-answer-mode="instant">答完立刻看答案</button>
          <button class="${state.answerMode === "batch" ? "active" : ""}" data-answer-mode="batch">统一对答案</button>
        </div>
        ${
          state.answerMode === "batch"
            ? `<div class="batch-tools">
                <span>已答 ${done}/${total}</span>
                <select data-batch-scope aria-label="统一判题范围">
                  <option value="section" ${state.batchScope === "section" ? "selected" : ""}>本小节后对答案</option>
                  <option value="chapter" ${state.batchScope === "chapter" ? "selected" : ""}>本章后对答案</option>
                </select>
              </div>`
            : `<p>选完即可查看解析，适合快速刷知识点。</p>`
        }
      </div>
    `;
  }

  function renderReview() {
    const questions = reviewQuestions();
    const correct = questions.filter((question) => state.answers[question.id]?.correct).length;
    return `
      <section class="workspace review-workspace">
        <div class="question-head">
          <div>
            <p>统一对答案 / ${escapeHtml(state.review.title)}</p>
            <h2>本组得分 ${correct}/${questions.length}</h2>
          </div>
          <button class="secondary compact" data-action="close-review">继续刷题</button>
        </div>
        <div class="review-summary">
          <div><span>正确率</span><b>${questions.length ? Math.round((correct / questions.length) * 100) : 0}%</b></div>
          <div><span>正确</span><b>${correct}</b></div>
          <div><span>错题</span><b class="danger">${questions.length - correct}</b></div>
        </div>
        <div class="review-list">
          ${questions
            .map((question, index) => {
              const selected = state.answers[question.id]?.selected || [];
              const ok = arraysEqual(selected, question.answer);
              return `
                <article class="review-item ${ok ? "right" : "miss"}">
                  <h3>${index + 1}. ${escapeHtml(question.stem)}</h3>
                  <div class="answer-line">
                    <span>正确答案：<b>${question.answer.map((i) => String.fromCharCode(65 + i)).join("、")}</b></span>
                    <span>你的答案：<b>${selected.length ? selected.map((i) => String.fromCharCode(65 + i)).join("、") : "未作答"}</b></span>
                    <strong>${ok ? icon("check") + " 正确" : icon("alert") + " 错误"}</strong>
                  </div>
                  <p><b>解析：</b>${escapeHtml(question.explanation)}</p>
                  <p><b>考点：</b>${escapeHtml(question.point)}</p>
                </article>
              `;
            })
            .join("")}
        </div>
        <div class="actions">
          <button class="secondary" data-action="redo-batch">重做本组</button>
          <button class="primary" data-action="close-review">继续刷题</button>
        </div>
      </section>
    `;
  }

  function renderDashboard(s) {
    const wrongQuestions = wrongQuestionsAll().slice(-5).reverse();
    return `
      <aside class="dashboard">
        <section class="data-panel">
          <div class="panel-head"><strong>学习数据</strong><span>本地保存</span></div>
          <div class="stat-grid">
            <div><span>正确率</span><b>${s.accuracy}%</b><em>已做 ${s.answered}</em></div>
            <div><span>正确题数</span><b>${s.correct}</b><em>继续稳住</em></div>
            <div><span>错题数</span><b class="danger">${s.wrong}</b><em>可强化</em></div>
            <div><span>收藏</span><b>${Object.keys(state.favorites).length}</b><em>重点看</em></div>
          </div>
        </section>
        <section class="data-panel">
          <div class="panel-head"><strong>薄弱知识点 TOP5</strong><span>错题率</span></div>
          <div class="weak-list">
            ${
              s.weak.length
                ? s.weak
                    .map(
                      (item) => `
                        <div class="weak-row">
                          <span>${escapeHtml(item.name)}</span>
                          <i><b style="width:${Math.max(item.rate, 8)}%"></b></i>
                          <em>${item.rate}%</em>
                        </div>
                      `
                    )
                    .join("")
                : `<p class="muted">做几道题后，这里会自动显示薄弱模块。</p>`
            }
          </div>
        </section>
        <section class="data-panel">
          <div class="panel-head"><strong>错题回顾</strong><span>${s.wrong} 题</span></div>
          <div class="wrong-list">
            ${
              wrongQuestions.length
                ? wrongQuestions
                    .map(
                      (question, index) => `
                        <button class="wrong-item" data-jump-wrong="${question.id}">
                          <b>错题</b><span>${index + 1}. ${escapeHtml(question.stem)}</span>
                        </button>
                      `
                    )
                    .join("")
                : `<p class="muted">当前没有错题。答错后会自动收入这里。</p>`
            }
          </div>
          <button class="wide" data-mode="wrong">查看全部错题</button>
          <div class="export-actions">
            <button class="wide" data-action="share-wrong">分享到备忘录</button>
            <button class="wide" data-action="copy-wrong">复制错题</button>
            <button class="wide" data-action="download-wrong">下载错题</button>
          </div>
          ${state.exportMessage ? `<p class="export-message">${escapeHtml(state.exportMessage)}</p>` : ""}
        </section>
      </aside>
    `;
  }

  function renderExam() {
    if (!state.exam || state.exam.done) {
      const result = state.exam?.done ? examResult() : null;
      return `
        <section class="workspace exam-start">
          <div class="exam-hero">
            <h2>${result ? "模拟考试已交卷" : "模拟考试"}</h2>
            <p>从当前题库随机抽取 30 题，单选和多选混合，答完后生成得分和薄弱模块。题库扩充后，模拟卷会自动变丰富。</p>
            ${
              result
                ? `<div class="score-card"><strong>${result.score}</strong><span>得分</span><p>正确 ${result.correct} / ${result.total}</p></div>`
                : ""
            }
            <button class="primary" data-action="start-exam">${icon("play")} 开始新试卷</button>
          </div>
        </section>
      `;
    }

    const examQuestions = state.exam.ids.map((id) => flatQuestions.find((question) => question.id === id)).filter(Boolean);
    const index = state.exam.index;
    const question = examQuestions[index];
    const selected = state.exam.answers[question.id] || [];
    return `
      <section class="workspace">
        <div class="question-head">
          <div>
            <p>模拟考试 / 第 ${index + 1} 题</p>
            <h2>${escapeHtml(question.point)}</h2>
          </div>
          <div class="timer">${formatTime(Date.now() - state.exam.startedAt)}</div>
        </div>
        <div class="question-meta">
          <span>${question.type === "multiple" ? "多选题" : "单选题"}</span>
          <b>${index + 1} / ${examQuestions.length}</b>
        </div>
        <article class="question-card">
          <h3>${index + 1}. ${escapeHtml(question.stem)}</h3>
          <div class="options">
            ${question.options
              .map(
                (option, optionIndex) => `
                  <button class="option ${selected.includes(optionIndex) ? "picked" : ""}" data-exam-option="${optionIndex}">
                    <b>${String.fromCharCode(65 + optionIndex)}</b>
                    <span>${escapeHtml(option)}</span>
                  </button>
                `
              )
              .join("")}
          </div>
        </article>
        <div class="actions">
          <button class="secondary" data-action="exam-prev">上一题</button>
          ${index === examQuestions.length - 1 ? `<button class="primary" data-action="submit-exam">交卷</button>` : `<button class="primary" data-action="exam-next">下一题</button>`}
        </div>
      </section>
    `;
  }

  function bindEvents() {
    app.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.mode = button.dataset.mode;
        state.questionIndex = 0;
        state.selected = [];
        state.revealed = false;
        state.review = null;
        persist();
        render();
      });
    });

    app.querySelectorAll("[data-section]").forEach((button) => {
      button.addEventListener("click", () => {
        state.mode = "practice";
        state.chapterId = button.dataset.chapter;
        state.sectionId = button.dataset.section;
        state.questionIndex = 0;
        state.selected = [];
        state.revealed = false;
        state.review = null;
        persist();
        render();
      });
    });

    app.querySelectorAll("[data-answer-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.answerMode = button.dataset.answerMode;
        state.selected = [];
        state.revealed = false;
        state.questionIndex = 0;
        state.review = null;
        persist();
        render();
      });
    });

    app.querySelectorAll("[data-batch-scope]").forEach((select) => {
      select.addEventListener("change", () => {
        state.batchScope = select.value;
        state.questionIndex = 0;
        state.selected = [];
        state.revealed = false;
        state.review = null;
        persist();
        render();
      });
    });

    app.querySelectorAll("[data-option]").forEach((button) => {
      button.addEventListener("click", () => {
        const question = currentQuestion();
        const index = Number(button.dataset.option);
        if (question.type === "single") {
          state.selected = [index];
        } else if (state.selected.includes(index)) {
          state.selected = state.selected.filter((item) => item !== index);
        } else {
          state.selected = [...state.selected, index];
        }
        render();
      });
    });

    app.querySelectorAll("[data-exam-option]").forEach((button) => {
      button.addEventListener("click", () => {
        const examQuestions = state.exam.ids.map((id) => flatQuestions.find((question) => question.id === id)).filter(Boolean);
        const question = examQuestions[state.exam.index];
        const index = Number(button.dataset.examOption);
        const selected = state.exam.answers[question.id] || [];
        if (question.type === "single") {
          state.exam.answers[question.id] = [index];
        } else if (selected.includes(index)) {
          state.exam.answers[question.id] = selected.filter((item) => item !== index);
        } else {
          state.exam.answers[question.id] = [...selected, index];
        }
        persist();
        render();
      });
    });

    app.querySelectorAll("[data-jump-wrong]").forEach((button) => {
      button.addEventListener("click", () => {
        state.mode = "wrong";
        state.questionIndex = Math.max(
          0,
          wrongQuestionsAll().findIndex((question) => question.id === button.dataset.jumpWrong)
        );
        state.selected = [];
        state.revealed = false;
        persist();
        render();
      });
    });

    app.querySelectorAll("[data-note]").forEach((textarea) => {
      textarea.addEventListener("input", () => {
        state.notes[textarea.dataset.note] = textarea.value;
        persist();
      });
    });

    app.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleAction(button.dataset.action));
    });
  }

  async function handleAction(action) {
    const question = currentQuestion();
    state.exportMessage = "";
    if (action === "favorite" && question) {
      state.favorites[question.id] ? delete state.favorites[question.id] : (state.favorites[question.id] = true);
    }
    if (action === "flag" && question) {
      state.flagged[question.id] ? delete state.flagged[question.id] : (state.flagged[question.id] = true);
    }
    if (action === "reveal" && question) {
      const correct = arraysEqual(state.selected, question.answer);
      state.answers[question.id] = {
        selected: state.selected,
        correct,
        at: new Date().toISOString()
      };
      state.revealed = true;
    }
    if (action === "save-next" && question) {
      state.pendingAnswers[question.id] = state.selected;
      moveQuestion(1);
    }
    if (action === "submit-batch" && question) {
      state.pendingAnswers[question.id] = state.selected;
      submitBatch();
    }
    if (action === "next") moveQuestion(1);
    if (action === "prev") moveQuestion(-1);
    if (action === "reset" && confirm("确定清空本地练习记录吗？题库不会删除。")) {
      localStorage.removeItem(storeKey);
      location.reload();
      return;
    }
    if (action === "start-exam") startExam();
    if (action === "exam-next") {
      state.exam.index = Math.min(state.exam.index + 1, state.exam.ids.length - 1);
    }
    if (action === "exam-prev") {
      state.exam.index = Math.max(state.exam.index - 1, 0);
    }
    if (action === "submit-exam") submitExam();
    if (action === "share-wrong") await shareWrongQuestions();
    if (action === "copy-wrong") await copyWrongQuestions();
    if (action === "download-wrong") downloadWrongQuestions();
    if (action === "close-review") {
      state.review = null;
      state.selected = [];
      state.revealed = false;
    }
    if (action === "redo-batch") {
      reviewQuestions().forEach((item) => {
        delete state.answers[item.id];
        delete state.pendingAnswers[item.id];
      });
      state.review = null;
      state.questionIndex = 0;
      state.selected = [];
      state.revealed = false;
    }
    persist();
    render();
  }

  function moveQuestion(delta) {
    const questions = practiceQuestions();
    state.questionIndex = (state.questionIndex + delta + questions.length) % questions.length;
    const next = questions[state.questionIndex];
    state.selected = state.answerMode === "batch" ? state.pendingAnswers[next.id] || [] : state.answers[next.id]?.selected || [];
    state.revealed = state.answerMode === "instant" && Boolean(state.answers[next.id]);
  }

  function submitBatch() {
    const questions = practiceQuestions();
    questions.forEach((question) => {
      const selected = state.pendingAnswers[question.id] || [];
      state.answers[question.id] = {
        selected,
        correct: arraysEqual(selected, question.answer),
        at: new Date().toISOString()
      };
    });
    state.review = {
      ids: questions.map((question) => question.id),
      title: activeBatchTitle()
    };
    state.selected = [];
    state.revealed = false;
  }

  function startExam() {
    const shuffled = [...flatQuestions].sort(() => Math.random() - 0.5).slice(0, Math.min(30, flatQuestions.length));
    state.exam = {
      ids: shuffled.map((question) => question.id),
      answers: {},
      index: 0,
      startedAt: Date.now(),
      done: false
    };
  }

  function submitExam() {
    state.exam.done = true;
    state.exam.finishedAt = Date.now();
    state.exam.ids.forEach((id) => {
      const question = flatQuestions.find((item) => item.id === id);
      const selected = state.exam.answers[id] || [];
      state.answers[id] = {
        selected,
        correct: arraysEqual(selected, question.answer),
        at: new Date().toISOString()
      };
    });
  }

  function examResult() {
    const total = state.exam.ids.length;
    const correct = state.exam.ids.filter((id) => {
      const question = flatQuestions.find((item) => item.id === id);
      return arraysEqual(state.exam.answers[id] || [], question.answer);
    }).length;
    return { total, correct, score: Math.round((correct / total) * 100) };
  }

  function answerLetters(indexes) {
    return indexes.length ? indexes.map((i) => String.fromCharCode(65 + i)).join("、") : "未作答";
  }

  function formatWrongQuestions() {
    const wrong = wrongQuestionsAll();
    if (!wrong.length) return "";
    const date = new Date().toLocaleString("zh-CN", { hour12: false });
    const lines = [`# 注安错题导出`, ``, `导出时间：${date}`, `错题数量：${wrong.length}`, ``];
    wrong.forEach((question, index) => {
      const record = state.answers[question.id] || {};
      lines.push(`## ${index + 1}. ${question.point}`);
      lines.push(`${question.chapterTitle} / ${question.sectionTitle}`);
      lines.push(`题目：${question.stem}`);
      question.options.forEach((option, optionIndex) => {
        lines.push(`${String.fromCharCode(65 + optionIndex)}. ${option}`);
      });
      lines.push(`正确答案：${answerLetters(question.answer)}`);
      lines.push(`我的答案：${answerLetters(record.selected || [])}`);
      lines.push(`解析：${question.explanation}`);
      if (state.notes[question.id]) lines.push(`我的笔记：${state.notes[question.id]}`);
      lines.push("");
    });
    return lines.join("\n");
  }

  async function shareWrongQuestions() {
    const text = formatWrongQuestions();
    if (!text) {
      state.exportMessage = "当前没有错题可导出。";
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: "注安错题导出", text });
        state.exportMessage = "已打开分享面板，可在 iPhone 上选择“备忘录”。";
        return;
      } catch (error) {
        if (error?.name === "AbortError") {
          state.exportMessage = "已取消分享。";
          return;
        }
      }
    }
    await copyWrongQuestions();
  }

  async function copyWrongQuestions() {
    const text = formatWrongQuestions();
    if (!text) {
      state.exportMessage = "当前没有错题可导出。";
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      state.exportMessage = "错题已复制，可粘贴到备忘录。";
    } catch (error) {
      state.exportMessage = "浏览器不允许直接复制，已改为下载文本文件。";
      downloadWrongQuestions();
    }
  }

  function downloadWrongQuestions() {
    const text = formatWrongQuestions();
    if (!text) {
      state.exportMessage = "当前没有错题可导出。";
      return;
    }
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `注安错题-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    state.exportMessage = "错题文件已生成下载。";
  }

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const minutes = String(Math.floor(total / 60)).padStart(2, "0");
    const seconds = String(total % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  render();
  setInterval(() => {
    if (state.mode === "exam" && state.exam && !state.exam.done) render();
  }, 1000);
})();
