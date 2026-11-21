# Plantilla de datos — `deberes.json`

Este documento describe, campo por campo, la estructura del archivo
`data/deberes.json` que usa `DEBERES.html`. Es solo documentación: los datos
reales viven en `deberes.json`.

```json
{
  "asignaturas": [
    {
      "nombre": "MATEMÁTICAS",
      "bloques": {
        "urgente":        [ TAREA, ... ],
        "estaSemana":     [ TAREA, ... ],
        "semanaQueViene": [ TAREA, ... ]
      }
    }
  ],
  "expectativas": [ PERIODO, ... ]
}
```

---

## 1. Raíz

| Campo          | Tipo      | Descripción                                              |
| -------------- | --------- | -------------------------------------------------------- |
| `asignaturas`  | `array`   | Lista de asignaturas, en orden fijo (siempre las 9).     |
| `expectativas` | `array`   | Historial de periodos. Nunca se borran los anteriores.   |

---

## 2. `asignaturas[]`

| Campo     | Tipo     | Descripción                                    |
| --------- | -------- | ---------------------------------------------- |
| `nombre`  | `string` | Nombre de la asignatura (ej. `"LENGUA"`).       |
| `bloques` | `object` | Contiene los tres bloques de urgencia.          |

### 2.1 `bloques`

Siempre existen estas tres claves, cada una con una lista de tareas:

| Clave            | Etiqueta mostrada   |
| ---------------- | ------------------- |
| `urgente`        | `¡Urgente!`         |
| `estaSemana`     | `Esta semana`       |
| `semanaQueViene` | `Semana que viene`  |

---

## 3. `TAREA`

Cada tarea es un objeto:

| Campo       | Tipo      | Descripción                                                     |
| ----------- | --------- | --------------------------------------------------------------- |
| `id`        | `string`  | Identificador único global. Se usa para enlazar con periodos.    |
| `texto`     | `string`  | Texto de la tarea.                                              |
| `hecha`     | `boolean` | `true` si está completada. Compartida con sus apariciones.       |
| `subtareas` | `array`   | Lista de `TAREA` anidadas (puede estar vacía).                  |

Ejemplo:

```json
{
  "id": "t_bio_1",
  "texto": "Hacer trabajos:",
  "hecha": false,
  "subtareas": [
    { "id": "t_bio_1_1", "texto": "1", "hecha": false, "subtareas": [] }
  ]
}
```

---

## 4. `PERIODO`

Un periodo de EXPECTATIVAS:

| Campo         | Tipo     | Descripción                                                         |
| ------------- | -------- | ------------------------------------------------------------------- |
| `id`          | `string` | Identificador único del periodo.                                    |
| `periodo`     | `string` | Texto libre con el rango temporal (ej. `"11/10/2026-13/10/2026"`).   |
| `estado`      | `string` | `"abierto"` o `"cerrado"`.                                          |
| `tareas`      | `array`  | Ids de las tareas que se quieren hacer en el periodo.               |
| `observacion` | `string` | Observación general opcional. Se muestra como texto tenue.          |
| `realizado`   | `object` | Foto fija del cierre. Ver abajo.                                   |

### 4.1 `realizado`

Se rellena automáticamente al pulsar **Cerrar periodo** (foto fija):

| Campo     | Tipo    | Descripción                                              |
| --------- | ------- | -------------------------------------------------------- |
| `hecho`   | `array` | Ids de las tareas del periodo marcadas como hechas.      |
| `noHecho` | `array` | Ids de las tareas del periodo NO marcadas como hechas.   |

Ejemplo completo:

```json
{
  "id": "exp_1",
  "periodo": "11/10/2026-13/10/2026",
  "estado": "cerrado",
  "tareas": ["t_mat_1", "t_mat_2"],
  "observacion": "El correo salió bien, pero no llegué a copiar todo.",
  "realizado": {
    "hecho": ["t_mat_1"],
    "noHecho": ["t_mat_2"]
  }
}
```

---

## 5. Notas

- Los `id` deben ser únicos en todo el archivo.
- Para generar uno nuevo, cualquier cadena única sirve (el HTML usa
  `t_...` para tareas y `exp_...` para periodos).
- `expectativas` es un historial: cada nuevo periodo se **añade** al final.
- Las tareas de un periodo son las mismas que aparecen en su asignatura
  (se enlazan por `id`), por eso marcar una afecta a la otra.
