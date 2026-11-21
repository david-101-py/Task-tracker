/* =========================================================
   DEBERES.html - lógica de la aplicación
   - Render de asignaturas y periodos de EXPECTATIVAS
   - Formularios para rellenar todo desde el HTML
   - Sincronización tarea <-> periodo
   - Autoguardado en localStorage + export/import JSON
   ========================================================= */

(function () {
  "use strict";

  var STORAGE_KEY = "deberes_data_v1";
  var THEME_KEY = "deberes_theme";

  var BLOCKS = [
    ["urgente", "¡Urgente!"],
    ["estaSemana", "Esta semana"],
    ["semanaQueViene", "Semana que viene"]
  ];

  /* Copia idéntica a data/deberes.json. Se usa como respaldo cuando el
     navegador no puede leer el JSON (p. ej. abriendo el archivo con doble
     clic, sin servidor). */
  var DEFAULT_DATA = {
    asignaturas: [
      {
        nombre: "MATEMÁTICAS",
        bloques: {
          urgente: [task("t_mat_1", "Escribir correo para lo que hay que hacer esta semana.")],
          estaSemana: [
            task("t_mat_2", "Copiar lo de la semana pasada."),
            task("t_mat_3", "Copiar lo de esta semana."),
            task("t_mat_4", "Escribir al profe para buscar una solución para lo de la última semana.")
          ],
          semanaQueViene: [task("t_mat_5", "Hablar con Lily para que me vaya diciendo lo que van haciendo cada día.")]
        }
      },
      {
        nombre: "LENGUA",
        bloques: {
          urgente: [task("t_len_1", "Leer Don Juan Tenorio.")],
          estaSemana: [
            task("t_len_2", "Hacer lo de la semana pasada."),
            task("t_len_3", "Hacer lo de esta semana."),
            task("t_len_4", "Escribir a Milagros sobre las dificultades."),
            task("t_len_5", "Mirar ideas para el cuaderno creativo."),
            task("t_len_6", "Estudiar.")
          ],
          semanaQueViene: [task("t_len_7", "Seguir con las tareas diarias."), task("t_len_8", "Estudiar.")]
        }
      },
      { nombre: "INGLÉS", bloques: { urgente: [], estaSemana: [], semanaQueViene: [] } },
      { nombre: "ALEMÁN", bloques: { urgente: [], estaSemana: [], semanaQueViene: [] } },
      {
        nombre: "FÍSICA Y QUÍMICA",
        bloques: {
          urgente: [],
          estaSemana: [task("t_fis_1", "Avanzar con ejercicios y temario.")],
          semanaQueViene: [task("t_fis_2", "Avanzar con ejercicios y temario.")]
        }
      },
      {
        nombre: "BIOLOGÍA Y GEOLOGÍA",
        bloques: {
          urgente: [],
          estaSemana: [
            {
              id: "t_bio_1",
              texto: "Hacer trabajos:",
              hecha: false,
              subtareas: [
                task("t_bio_1_1", "1"),
                task("t_bio_1_2", "2"),
                task("t_bio_1_3", "3"),
                task("t_bio_1_4", "4")
              ]
            }
          ],
          semanaQueViene: [
            task("t_bio_2", "Hacer lo que me mande hacer para la semana."),
            task("t_bio_3", "Estudiar.")
          ]
        }
      },
      {
        nombre: "GEOGRAFÍA E HISTORIA",
        bloques: {
          urgente: [],
          estaSemana: [task("t_geo_1", "Estudiar.")],
          semanaQueViene: [task("t_geo_2", "Estudiar.")]
        }
      },
      {
        nombre: "UNIÓN EUROPEA",
        bloques: {
          urgente: [],
          estaSemana: [task("t_ue_1", "Avanzar con el trabajo de Alemania en la UE.")],
          semanaQueViene: [task("t_ue_2", "Avanzar con el trabajo de Alemania en la UE.")]
        }
      },
      {
        nombre: "EDUCACIÓN FÍSICA",
        bloques: {
          urgente: [],
          estaSemana: [task("t_ef_1", "Practicar al menos 2 veces lo de Mobility Flow.")],
          semanaQueViene: [task("t_ef_2", "Practicar al menos 2 veces lo de Mobility Flow.")]
        }
      }
    ],
    expectativas: []
  };

  function task(id, texto) {
    return { id: id, texto: texto, hecha: false, subtareas: [] };
  }

  var state = null;
  var savedTimer = null;

  var ui = {
    editingTask: null,
    editingObs: null,
    addingSubtask: null,
    addingToBlock: null,
    addingPeriodTask: null,
    newPeriod: false,
    lastSubject: null,
    lastBlock: null
  };

  /* ---------------- utilidades ---------------- */

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function h(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === undefined || v === null) return;
        if (k === "class") e.className = v;
        else if (k === "text") e.textContent = v;
        else if (k === "html") e.innerHTML = v;
        else if (k === "dataset") {
          Object.keys(v).forEach(function (d) { e.dataset[d] = v[d]; });
        } else if (k.slice(0, 2) === "on" && typeof v === "function") {
          e.addEventListener(k.slice(2).toLowerCase(), v);
        } else {
          e.setAttribute(k, v);
        }
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
    });
    return e;
  }

  function findTask(id) {
    for (var a = 0; a < state.asignaturas.length; a++) {
      var asig = state.asignaturas[a];
      for (var b = 0; b < BLOCKS.length; b++) {
        var key = BLOCKS[b][0];
        var res = searchList(asig.bloques[key] || [], id, asig, key);
        if (res) return res;
      }
    }
    return null;
  }

  function searchList(arr, id, asig, key) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) return { task: arr[i], parent: arr, name: asig.nombre, bloque: key };
      if (arr[i].subtareas && arr[i].subtareas.length) {
        var r = searchList(arr[i].subtareas, id, asig, key);
        if (r) return r;
      }
    }
    return null;
  }

  function taskLabel(id) {
    var f = findTask(id);
    return f ? f.task.texto : "(tarea eliminada)";
  }

  function deleteTask(id) {
    var f = findTask(id);
    if (f) {
      var i = f.parent.indexOf(f.task);
      if (i >= 0) f.parent.splice(i, 1);
    }
    state.expectativas.forEach(function (per) {
      per.tareas = per.tareas.filter(function (x) { return x !== id; });
      per.realizado.hecho = per.realizado.hecho.filter(function (x) { return x !== id; });
      per.realizado.noHecho = per.realizado.noHecho.filter(function (x) { return x !== id; });
    });
  }

  function normalize(data) {
    if (!data || !Array.isArray(data.asignaturas)) throw new Error("estructura no válida");
    var expectativas = Array.isArray(data.expectativas)
      ? data.expectativas
      : Array.isArray(data.expectaciones) ? data.expectaciones : [];
    return {
      asignaturas: data.asignaturas.map(function (a) {
        var bloques = {};
        BLOCKS.forEach(function (p) {
          bloques[p[0]] = a.bloques && Array.isArray(a.bloques[p[0]]) ? a.bloques[p[0]] : [];
        });
        return { nombre: a.nombre || "SIN NOMBRE", bloques: bloques };
      }),
      expectativas: expectativas.map(function (per) {
        return {
          id: per.id || uid("exp_"),
          periodo: per.periodo || "",
          estado: per.estado === "cerrado" ? "cerrado" : "abierto",
          tareas: Array.isArray(per.tareas) ? per.tareas : [],
          observacion: per.observacion || "",
          realizado: {
            hecho: per.realizado && Array.isArray(per.realizado.hecho) ? per.realizado.hecho : [],
            noHecho: per.realizado && Array.isArray(per.realizado.noHecho) ? per.realizado.noHecho : []
          }
        };
      })
    };
  }

  /* ---------------- persistencia ---------------- */

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* almacenamiento no disponible */
    }
    markSaved();
  }

  function markSaved() {
    var el = document.getElementById("save-status");
    if (!el) return;
    el.textContent = "Guardado";
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { el.textContent = ""; }, 1500);
  }

  function notice(texto) {
    var el = document.getElementById("save-status");
    if (!el) return;
    el.textContent = texto;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { el.textContent = ""; }, 2600);
  }

  function refresh() {
    renderAsignaturas();
    renderPeriodos();
    focusPending();
  }

  function saveRefresh() {
    save();
    refresh();
  }

  /* ---------------- tema ---------------- */

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    var btn = document.getElementById("btn-theme");
    if (btn) btn.textContent = t === "dark" ? "Modo claro" : "Modo oscuro";
  }

  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme");
    var next = cur === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
  }

  /* ---------------- render: asignaturas ---------------- */

  function countTasks(asig) {
    var total = 0, done = 0;
    BLOCKS.forEach(function (p) {
      (asig.bloques[p[0]] || []).forEach(function (t) {
        total++;
        if (t.hecha) done++;
      });
    });
    return { total: total, done: done };
  }

  function renderAsignaturas() {
    var wrap = document.getElementById("asignaturas");
    wrap.innerHTML = "";
    state.asignaturas.forEach(function (asig, ai) {
      var c = countTasks(asig);
      var card = h("section", { class: "card" });
      card.appendChild(
        h("div", { class: "card-head" }, [
          h("span", { text: asig.nombre }),
          h("span", { class: "count", text: c.done + "/" + c.total })
        ])
      );
      BLOCKS.forEach(function (p) {
        card.appendChild(renderBlock(asig, ai, p[0], p[1]));
      });
      wrap.appendChild(card);
    });
  }

  function renderBlock(asig, ai, key, label) {
    var tasks = asig.bloques[key] || (asig.bloques[key] = []);
    var block = h("div", { class: "block block-" + key });
    block.appendChild(h("div", { class: "block-head" }, [h("span", { class: "pill pill-" + key, text: label })]));

    var body = h("div", { class: "block-body" });
    var ul = h("ul", { class: "tasks" });
    tasks.forEach(function (t) { ul.appendChild(renderTask(t)); });
    body.appendChild(ul);

    var addKey = ai + "|" + key;
    if (ui.addingToBlock === addKey) {
      body.appendChild(
        addForm(
          "Nueva tarea…",
          "data-add-block",
          addKey,
          function (v) { tasks.push(makeTask(v)); ui.addingToBlock = null; saveRefresh(); },
          function () { ui.addingToBlock = null; refresh(); }
        )
      );
    } else {
      body.appendChild(
        h("button", { class: "btn btn-ghost btn-sm", onclick: function () { ui.addingToBlock = addKey; ui.editingTask = null; refresh(); } }, ["+ Añadir tarea"])
      );
    }

    block.appendChild(body);
    return block;
  }

  function makeTask(texto) {
    return { id: uid("t_"), texto: texto, hecha: false, subtareas: [] };
  }

  function renderTask(task) {
    var li = h("li", { class: "task" + (task.hecha ? " done" : "") });

    var cb = h("input", { type: "checkbox", class: "task-check" });
    cb.checked = task.hecha;
    cb.addEventListener("change", function () { task.hecha = cb.checked; save(); refresh(); });

    var textEl;
    if (ui.editingTask === task.id) {
      var input = h("input", { type: "text", class: "task-input", "data-edit-task": task.id });
      input.value = task.texto;
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          task.texto = input.value.trim() || task.texto;
          ui.editingTask = null;
          saveRefresh();
        } else if (e.key === "Escape") {
          ui.editingTask = null;
          refresh();
        }
      });
      input.addEventListener("blur", function () {
        if (ui.editingTask === task.id) {
          task.texto = input.value.trim() || task.texto;
          ui.editingTask = null;
          saveRefresh();
        }
      });
      textEl = input;
    } else {
      textEl = h("span", {
        class: "task-text",
        text: task.texto,
        title: "Editar",
        onclick: function () { ui.editingTask = task.id; ui.addingSubtask = null; refresh(); }
      });
    }

    var actions = h("div", { class: "row-actions" }, [
      h("button", { class: "btn btn-ghost btn-sm", onclick: function () { ui.editingTask = task.id; ui.addingSubtask = null; refresh(); } }, ["Editar"]),
      h("button", { class: "btn btn-ghost btn-sm", onclick: function () { ui.addingSubtask = task.id; ui.editingTask = null; refresh(); } }, ["+ Sub"]),
      h("button", { class: "btn btn-ghost btn-sm btn-danger", onclick: function () {
        if (confirm("¿Borrar la tarea «" + task.texto + "»?")) { deleteTask(task.id); saveRefresh(); }
      } }, ["Borrar"])
    ]);

    li.appendChild(h("div", { class: "task-row" }, [cb, textEl, actions]));

    if (task.subtareas && task.subtareas.length) {
      var sub = h("ul", { class: "subtasks" });
      task.subtareas.forEach(function (s) { sub.appendChild(renderTask(s)); });
      li.appendChild(sub);
    }

    if (ui.addingSubtask === task.id) {
      li.appendChild(
        addForm(
          "Nueva subtarea…",
          "data-add-sub",
          task.id,
          function (v) { task.subtareas.push(makeTask(v)); ui.addingSubtask = null; saveRefresh(); },
          function () { ui.addingSubtask = null; refresh(); }
        )
      );
    }

    return li;
  }

  function addForm(placeholder, dataAttr, dataVal, onAdd, onCancel) {
    var input = h("input", { type: "text", placeholder: placeholder });
    input.setAttribute(dataAttr, dataVal);
    var form = h("div", { class: "inline-form" }, [input]);

    function commit() {
      var v = input.value.trim();
      if (!v) return;
      onAdd(v);
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { onCancel(); }
    });
    form.appendChild(h("button", { class: "btn btn-primary btn-sm", onclick: commit }, ["Añadir"]));
    form.appendChild(h("button", { class: "btn btn-ghost btn-sm", onclick: onCancel }, ["Cancelar"]));
    return form;
  }

  /* ---------------- render: expectativas ---------------- */

  function renderPeriodos() {
    var wrap = document.getElementById("periodos");
    wrap.innerHTML = "";

    if (ui.newPeriod) wrap.appendChild(renderNewPeriodForm());
    else if (state.expectativas.length === 0) {
      wrap.appendChild(h("p", { class: "empty", text: "Todavía no hay periodos. Pulsa «+ Nuevo periodo» para crear el primero." }));
    }

    state.expectativas.forEach(function (per) { wrap.appendChild(renderPeriodo(per)); });
  }

  function renderNewPeriodForm() {
    var input = h("input", { type: "text", id: "new-period-input", placeholder: "Periodo (ej. 11/10/2026-13/10/2026)" });
    var form = h("div", { class: "inline-form" }, [input]);

    function create() {
      var v = input.value.trim();
      if (!v) return;
      state.expectativas.push({
        id: uid("exp_"),
        periodo: v,
        estado: "abierto",
        tareas: [],
        observacion: "",
        realizado: { hecho: [], noHecho: [] }
      });
      ui.newPeriod = false;
      saveRefresh();
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); create(); }
      else if (e.key === "Escape") { ui.newPeriod = false; refresh(); }
    });
    form.appendChild(h("button", { class: "btn btn-primary btn-sm", onclick: create }, ["Crear"]));
    form.appendChild(h("button", { class: "btn btn-ghost btn-sm", onclick: function () { ui.newPeriod = false; refresh(); } }, ["Cancelar"]));

    return h("div", { class: "periodo" }, [h("div", { class: "period-head" }, [h("h3", { text: "Nuevo periodo" })]), form]);
  }

  function renderPeriodo(per) {
    var abierto = per.estado === "abierto";
    var card = h("div", { class: "periodo" });

    card.appendChild(
      h("div", { class: "period-head" }, [
        h("h3", { text: per.periodo }),
        h("span", { class: "badge " + (abierto ? "badge-abierto" : "badge-cerrado"), text: abierto ? "abierto" : "cerrado" })
      ])
    );

    card.appendChild(h("div", { class: "period-sub", text: "Plan" }));
    var ul = h("ul", { class: "tasks" });
    if (per.tareas.length === 0) {
      ul.appendChild(h("li", { class: "empty", text: "Sin tareas planificadas." }));
    }
    per.tareas.forEach(function (id) {
      var f = findTask(id);
      if (f) ul.appendChild(renderPeriodTask(f.task, per, abierto, f.name));
      else ul.appendChild(h("li", { class: "task" }, [h("div", { class: "task-row" }, [h("span", { class: "task-text", text: "(tarea eliminada)" })])]));
    });
    card.appendChild(ul);

    if (abierto) card.appendChild(renderPeriodTaskForm(per));

    if (!abierto) {
      card.appendChild(
        h("div", { class: "realizado" }, [
          realCol("real-hecho", "Hecho", per.realizado.hecho),
          realCol("real-nohecho", "No hecho", per.realizado.noHecho)
        ])
      );
    }

    if (ui.editingObs === per.id) {
      var ta = h("textarea", { "data-edit-obs": per.id, placeholder: "Observación general del periodo…" });
      ta.value = per.observacion;
      ta.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitObs(); }
        else if (e.key === "Escape") { ui.editingObs = null; refresh(); }
      });
      function commitObs() {
        per.observacion = ta.value.trim();
        ui.editingObs = null;
        saveRefresh();
      }
      card.appendChild(ta);
      card.appendChild(
        h("div", { class: "period-actions" }, [
          h("button", { class: "btn btn-primary btn-sm", onclick: commitObs }, ["Guardar observación"]),
          h("button", { class: "btn btn-ghost btn-sm", onclick: function () { ui.editingObs = null; refresh(); } }, ["Cancelar"])
        ])
      );
    } else if (per.observacion) {
      card.appendChild(h("p", { class: "observacion", text: per.observacion }));
    }

    var actions = h("div", { class: "period-actions" });
    if (abierto) {
      actions.appendChild(h("button", { class: "btn btn-primary btn-sm", onclick: function () { closePeriodo(per); } }, ["Cerrar periodo"]));
    }
    actions.appendChild(
      h("button", { class: "btn btn-ghost btn-sm", onclick: function () { ui.editingObs = per.id; ui.newPeriod = false; refresh(); } },
        [per.observacion ? "Editar observación" : "+ Observación"])
    );
    card.appendChild(actions);

    return card;
  }

  function renderPeriodTaskForm(per) {
    if (ui.addingPeriodTask !== per.id) {
      return h("button", { class: "btn btn-ghost btn-sm", onclick: function () { ui.addingPeriodTask = per.id; ui.newPeriod = false; refresh(); } }, ["+ Añadir tarea al periodo"]);
    }

    var tinput = h("input", { type: "text", placeholder: "Tarea…" });
    tinput.setAttribute("data-add-ptext", per.id);
    var ssel = h("select", {});
    state.asignaturas.forEach(function (a) { ssel.appendChild(h("option", { value: a.nombre, text: a.nombre })); });
    var bsel = h("select", {});
    BLOCKS.forEach(function (p) { bsel.appendChild(h("option", { value: p[0], text: p[1] })); });

    if (ui.lastSubject && subjectByName(ui.lastSubject)) ssel.value = ui.lastSubject;
    for (var bi = 0; bi < BLOCKS.length; bi++) if (BLOCKS[bi][0] === ui.lastBlock) bsel.value = ui.lastBlock;

    var sugWrap = h("div", { class: "pt-sugerencias" });

    function subjectByName(name) {
      var found = null;
      state.asignaturas.forEach(function (a) { if (a.nombre === name) found = a; });
      return found;
    }

    function blockLabel(key) {
      for (var i = 0; i < BLOCKS.length; i++) if (BLOCKS[i][0] === key) return BLOCKS[i][1];
      return key;
    }

    function existingTasks() {
      var asig = subjectByName(ssel.value);
      return asig ? (asig.bloques[bsel.value] || []) : [];
    }

    function refreshSug() {
      sugWrap.innerHTML = "";
      var all = existingTasks();
      if (!all.length) {
        sugWrap.appendChild(h("span", { class: "pt-hint", text: "No hay tareas en este apartado; escribe para crear una nueva." }));
        return;
      }
      var q = tinput.value.trim().toLowerCase();
      var pool = all.filter(function (t) { return !q || t.texto.toLowerCase().indexOf(q) !== -1; });
      if (!pool.length) {
        sugWrap.appendChild(h("span", { class: "pt-hint", text: "Ninguna coincide. Se creará una tarea nueva." }));
        return;
      }
      pool.forEach(function (t) {
        sugWrap.appendChild(
          h("button", {
            type: "button",
            class: "chip",
            title: "Usar esta tarea existente",
            onclick: function () { tinput.value = t.texto; tinput.focus(); refreshSug(); }
          }, [t.texto])
        );
      });
    }

    function commit() {
      var txt = tinput.value.trim();
      if (!txt) return;
      var asig = subjectByName(ssel.value);
      if (!asig) return;
      if (!asig.bloques[bsel.value]) asig.bloques[bsel.value] = [];
      var list = asig.bloques[bsel.value];

      var existing = null;
      list.forEach(function (t) { if (t.texto.toLowerCase() === txt.toLowerCase()) existing = t; });

      var task;
      if (existing) {
        task = existing;
      } else {
        if (!confirm('La tarea «' + txt + '» no existe en ' + asig.nombre + ' · ' + blockLabel(bsel.value) + '. ¿Crearla desde cero?')) return;
        task = makeTask(txt);
        list.push(task);
      }

      ui.addingPeriodTask = null;
      if (per.tareas.indexOf(task.id) !== -1) { refresh(); return; }
      per.tareas.push(task.id);
      saveRefresh();
    }

    function cancel() { ui.addingPeriodTask = null; refresh(); }

    tinput.addEventListener("input", refreshSug);
    tinput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { cancel(); }
    });
    ssel.addEventListener("change", function () { ui.lastSubject = ssel.value; refreshSug(); });
    bsel.addEventListener("change", function () { ui.lastBlock = bsel.value; refreshSug(); });

    var row = h("div", { class: "inline-form" }, [tinput, ssel, bsel]);
    row.appendChild(h("button", { class: "btn btn-primary btn-sm", onclick: commit }, ["Añadir"]));
    row.appendChild(h("button", { class: "btn btn-ghost btn-sm", onclick: cancel }, ["Cancelar"]));

    var form = h("div", { class: "pt-form" }, [row, sugWrap]);
    refreshSug();
    return form;
  }

  function renderPeriodTask(task, per, abierto, subjectName) {
    var li = h("li", { class: "task" + (task.hecha ? " done" : "") });

    var cb = h("input", { type: "checkbox", class: "task-check" });
    cb.checked = task.hecha;
    cb.disabled = !abierto;
    cb.addEventListener("change", function () { task.hecha = cb.checked; save(); refresh(); });

    var row = h("div", { class: "task-row" }, [
      cb,
      h("span", { class: "task-text", text: task.texto }),
      h("span", { class: "count", text: subjectName || "" })
    ]);

    if (abierto) {
      row.appendChild(
        h("div", { class: "row-actions" }, [
          h("button", { class: "btn btn-ghost btn-sm btn-danger", onclick: function () {
            per.tareas = per.tareas.filter(function (x) { return x !== task.id; });
            saveRefresh();
          } }, ["Quitar"])
        ])
      );
    }

    li.appendChild(row);
    return li;
  }

  function realCol(cls, title, ids) {
    var ul = h("ul", {});
    if (!ids.length) ul.appendChild(h("li", { class: "empty", text: "Nada." }));
    else ids.forEach(function (id) { ul.appendChild(h("li", { text: taskLabel(id) })); });
    return h("div", { class: "real-col " + cls }, [h("h4", { text: title }), ul]);
  }

  function closePeriodo(per) {
    if (!confirm("¿Cerrar el periodo «" + per.periodo + "»? Se guardará una foto fija del estado actual y ya no se podrá editar.")) return;
    per.realizado.hecho = per.tareas.filter(function (id) {
      var f = findTask(id);
      return f && f.task.hecha;
    });
    per.realizado.noHecho = per.tareas.filter(function (id) {
      var f = findTask(id);
      return !f || !f.task.hecha;
    });
    per.estado = "cerrado";
    saveRefresh();
  }

  /* ---------------- foco ---------------- */

  function focusPending() {
    var sel = null;
    if (ui.editingTask) sel = '[data-edit-task="' + ui.editingTask + '"]';
    else if (ui.editingObs) sel = '[data-edit-obs="' + ui.editingObs + '"]';
    else if (ui.addingSubtask) sel = '[data-add-sub="' + ui.addingSubtask + '"]';
    else if (ui.addingToBlock) sel = '[data-add-block="' + ui.addingToBlock + '"]';
    else if (ui.addingPeriodTask) sel = '[data-add-ptext="' + ui.addingPeriodTask + '"]';
    else if (ui.newPeriod) sel = "#new-period-input";
    if (!sel) return;
    var el = document.querySelector(sel);
    if (el) { el.focus(); if (el.select) el.select(); }
  }

  /* ---------------- exportar / importar ---------------- */

  function exportJSON() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "deberes.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        state = normalize(JSON.parse(reader.result));
        saveRefresh();
      } catch (e) {
        alert("El archivo JSON no tiene el formato esperado.");
      }
    };
    reader.readAsText(file);
  }

  /* ---------------- borrado ---------------- */

  function uncheckList(arr) {
    arr.forEach(function (t) {
      t.hecha = false;
      if (t.subtareas && t.subtareas.length) uncheckList(t.subtareas);
    });
  }

  function clearSelections() {
    state.asignaturas.forEach(function (a) {
      BLOCKS.forEach(function (p) {
        if (Array.isArray(a.bloques[p[0]])) uncheckList(a.bloques[p[0]]);
      });
    });
    state.expectativas = [];
    ui.addingPeriodTask = null;
    ui.newPeriod = false;
  }

  function clearAllData() {
    state = {
      asignaturas: state.asignaturas.map(function (a) {
        var bloques = {};
        BLOCKS.forEach(function (p) { bloques[p[0]] = []; });
        return { nombre: a.nombre, bloques: bloques };
      }),
      expectativas: []
    };
    ui.addingPeriodTask = null;
    ui.newPeriod = false;
    ui.editingTask = null;
    ui.editingObs = null;
    ui.addingSubtask = null;
    ui.addingToBlock = null;
  }

  /* ---------------- arranque ---------------- */

  function bindToolbar() {
    document.getElementById("btn-export").addEventListener("click", exportJSON);
    document.getElementById("btn-theme").addEventListener("click", toggleTheme);
    document.getElementById("btn-nuevo-periodo").addEventListener("click", function () {
      ui.newPeriod = true;
      ui.addingPeriodTask = null;
      refresh();
    });
    var resetGroup = document.getElementById("reset-group");
    var resetLabel = resetGroup.querySelector(".reset-label");
    var btnClearTasks = document.getElementById("btn-clear-tasks");
    var btnClearSelections = document.getElementById("btn-clear-selections");

    function setResetMode(mode) {
      resetGroup.dataset.mode = mode;
      resetLabel.textContent = mode === "red" ? "Eliminar" : mode === "blue" ? "Borrar" : "Restablecer";
    }

    btnClearTasks.addEventListener("mouseenter", function () { setResetMode("red"); });
    btnClearTasks.addEventListener("focus", function () { setResetMode("red"); });
    btnClearSelections.addEventListener("mouseenter", function () { setResetMode("blue"); });
    btnClearSelections.addEventListener("focus", function () { setResetMode("blue"); });
    resetGroup.addEventListener("mouseleave", function () { setResetMode("idle"); });
    btnClearTasks.addEventListener("blur", function () { setResetMode("idle"); });
    btnClearSelections.addEventListener("blur", function () { setResetMode("idle"); });

    btnClearSelections.addEventListener("click", function () {
      clearSelections();
      saveRefresh();
      notice("Selecciones borradas");
    });

    btnClearTasks.addEventListener("click", function () {
      if (!confirm("¿Eliminar TODOS los datos? Se borrarán todas las tareas y los periodos. Esta acción no se puede deshacer.")) return;
      clearAllData();
      saveRefresh();
      notice("Datos eliminados");
    });
    var fileInput = document.getElementById("file-import");
    document.getElementById("btn-import").addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function (e) {
      var f = e.target.files[0];
      if (f) importJSON(f);
      e.target.value = "";
    });
  }

  function init() {
    applyTheme(localStorage.getItem(THEME_KEY) || "dark");
    bindToolbar();

    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}

    if (stored) {
      try { state = normalize(JSON.parse(stored)); }
      catch (e) { state = clone(DEFAULT_DATA); }
      refresh();
      return;
    }

    fetch("data/deberes.json")
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (data) { state = normalize(data); refresh(); })
      .catch(function () { state = clone(DEFAULT_DATA); refresh(); });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
