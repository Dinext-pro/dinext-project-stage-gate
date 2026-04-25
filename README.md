# Dinext Project Stage Gate

## 📖 Обзор

`dinext_project_stage_gate` добавляет отдельный слой управления по модели Stage-gate поверх стандартных записей ERPNext `Project`. Приложение сохраняет `Project` как основной бизнес-объект и вводит отдельные metadata- и transactional-DocType для реестра стадий, моделей управления, шаблонов gate, исполнения стадий, согласования checkpoint и дорожной карты.

Реализация намеренно независима от стандартного workflow `Project` и от подхода `Task Type = Stage/Phase`. Задачи, issues и существующие связи с портфелями по-прежнему можно использовать как связанные артефакты и evidence, но источником истины для управленческого продвижения проекта является доменная модель Stage-gate.

## ✨ Возможности

- Отдельные master-справочники для `Project Stage`, `Project Governance Model`, `Stage Gate Template` и `Project Gate Checkpoint Level`
- Transactional-слой исполнения через `Project Stage Instance`, `Project Gate Checkpoint` и `Project Gate Checklist Item`
- Whitelisted Python API для цепочки стадий проекта и данных roadmap-отчета
- Виджет на форме `Project`, подключаемый через `doctype_js`, без отдельного HTML custom field
- Кнопка `Project Stage Gate Roadmap` на форме `Project Portfolio`, открывающая отчет сразу с фильтром по текущему портфелю
- Автоматическое создание `Project Stage Instance` при назначении `Project Governance Model` проекту
- Автоматическое создание `Project Gate Checkpoint` из `Checkpoint Template`, указанного в строке модели управления
- Автоматическое обновление полей `current_stage_instance`, `current_stage`, `stage_gate_status` и `current_gate_result` на `Project`
- Автоматический расчет `planned_start_date` / `planned_end_date` у `Project Stage Instance` по `expected_start_date`, `expected_duration_days` и рабочим дням из holiday list проекта / компании
- Контролируемый сброс цепочки при смене или очистке `governance_model`: подтверждение на форме `Project`, отмена активных `Project Stage Instance` / `Project Gate Checkpoint` / строк чек-листа (статус `Canceled`), версионирование цепочки (`stage_chain_version`), скрытие архивных цепочек из виджета и roadmap
- Script Report дорожной карты Stage-gate с ленивой загрузкой ECharts
- Ролевая и permission-модель для `Stage Gate Owner`, `Stage Gate Reviewer`, `Stage Gate Approver` и `Project Governance Admin`
- Отдельный workflow checkpoint, не изменяющий существующий approval-flow `Project`
- На форме `Project Gate Checkpoint` строки чеклиста с флагом **Is Mandatory** нельзя удалить, пока флаг не снят; кнопка массового удаления **«Удалить все строки»** для таблицы чеклиста скрыта (см. `project_gate_checkpoint.js`)
- При каждом сохранении `Project Gate Checkpoint` сервер пересчитывает скрытое поле **Checklist Completed** (`checklist_completed`): оно равно установленному флагу, только если все строки чеклиста в статусе **Done** или **Canceled**; иначе сбрасывается (в том числе если пункт снова переведён в **Open**). Это поле используется в fixture workflow как условие перехода **Submit for Review** (Draft → In Review)

## 🚀 Установка

Установите приложение в существующий Administrator, где уже есть `erpnext` и `dinext_projects`:

```bash
cd /path/to/frappe-bench
bench get-app <repo-url> --branch develop
bench --site <site> install-app dinext_project_stage_gate
bench --site <site> migrate
```

Если вы применяете metadata-изменения в developer mode, убедитесь, что он включен на сайте до создания или обновления DocType:

```bash
bench --site <site> set-config developer_mode 1
```

После site-level metadata-изменений экспортируйте fixtures, чтобы состояние репозитория совпадало с базой данных:

```bash
bench --site <site> export-fixtures --app dinext_project_stage_gate
```

## 🛠️ Использование

### Назначение модели управления проекту

1. Создайте или обновите записи `Project Stage`.
2. Создайте записи `Project Gate Checkpoint Level` для нужных уровней согласования.
3. Создайте `Stage Gate Template`, связанные с `Project Gate Checkpoint Level`.
4. Соберите `Project Governance Model` с упорядоченными строками стадий; при необходимости укажите в каждой строке поле **Checkpoint Template** (ссылка на `Stage Gate Template`).
5. Назначьте модель управления документу `Project`.
6. Сохраните `Project`.

После сохранения серверный hook автоматически:

1. Загружает выбранный `Project Governance Model`.
2. Строит упорядоченную stage chain.
3. Создает записи `Project Stage Instance` с детерминированными именами: первая цепочка — `<PROJECT>-STAGE-001`, при повторном назначении модели после сброса — `<PROJECT>-SG<N>-STAGE-001` (N = `stage_chain_version` на `Project`).
4. Заполняет связи `previous_stage_instance` / `next_stage_instance`.
5. Обновляет summary-поля на `Project`.

Для каждой созданной `Project Stage Instance`, у которой в соответствующей строке модели управления задан **Checkpoint Template**, создаётся документ `Project Gate Checkpoint` с чек-листом, скопированным из шаблона (имя вида `<PROJECT>-STAGE-001-GATE`). Если шаблон в строке не указан, чекпоинт не создаётся. Если шаблон выключен или не содержит ни одного пункта чек-листа, создание цепочки прерывается валидационной ошибкой.

Плановые даты `Project Stage Instance` вычисляются автоматически:

1. Для первой стадии `planned_start_date` берётся из `Project.expected_start_date` (или `today()`), затем сдвигается на ближайший рабочий день.
2. Для следующих стадий старт определяется как ближайший рабочий день после `planned_end_date` предыдущей стадии.
3. `planned_end_date` считается по `expected_duration_days` строки модели управления с учетом holiday list проекта или компании.
4. При переводе стадии в `Active` или `Completed` документ автоматически проставляет `actual_start_date`; при `Completed` также заполняет `actual_end_date`, если эти даты не были заданы вручную.

При редактировании чеклиста на форме `Project Gate Checkpoint` удаление строки с установленным **Is Mandatory** блокируется на клиенте до тех пор, пока флаг не снят; после снятия флага строку можно удалить и сохранить документ одним сохранением. Массовое удаление всех строк таблицы недоступно (кнопка скрыта), чтобы нельзя было обойти эту проверку.

Статусы строк чеклиста (**Open**, **Done**, **Canceled**) задаются в `Project Gate Checklist Item`. После сохранения чекпоинта поле **Checklist Completed** обновляется в контроллере [`project_gate_checkpoint.py`](dinext_project_stage_gate/dinext_project_stage_gate/doctype/project_gate_checkpoint/project_gate_checkpoint.py): оно истинно только когда каждая строка в терминальном статусе (**Done** или **Canceled**). Условие `doc.checklist_completed` в [`fixtures/workflow.json`](dinext_project_stage_gate/fixtures/workflow.json) разрешает действие workflow **Submit for Review** только при полностью закрытом чеклисте.

Дальше форма `Project` использует whitelisted API для отрисовки уже сохраненной Stage-gate цепочки. Если модель управления не назначена, виджет не показывается.

На форме `Project Portfolio` появляется кнопка в меню `View`, которая открывает Script Report `Project Stage Gate Roadmap` с уже заполненным фильтром `portfolio` для текущего портфеля.

Если цепочка уже создана, смена или очистка `governance_model` требует подтверждения в диалоге на форме `Project`. После подтверждения и сохранения текущая активная цепочка переводится в архив (все связанные исполнительные документы — в статус `Canceled`), номер активной версии цепочки на `Project` увеличивается; при назначенной новой модели создаётся новая цепочка, при пустой модели summary-поля проекта очищаются. Исторические строки остаются в БД, но не попадают в виджет и выборки roadmap для активной версии.

### Вызов API

Приложение предоставляет два основных whitelisted-метода:

```python
dinext_project_stage_gate.stage_gate.api.get_project_stage_chain(project)
dinext_project_stage_gate.stage_gate.api.get_roadmap_dataset(filters=None)
```

Вызов через bench:

```bash
bench --site <site> execute dinext_project_stage_gate.stage_gate.api.ping
bench --site <site> execute dinext_project_stage_gate.stage_gate.api.get_roadmap_dataset
```

## 📦 Технологии

- Python 3.10+
- Frappe Framework / ERPNext
- JavaScript form scripts и Script Reports
- ECharts для визуализации дорожной карты
- Node.js built-in test runner для изолированных JS regression-тестов
- Ruff для Python linting
- Prettier / ESLint / pyupgrade через pre-commit tooling

## 🔧 Конфигурация

Основная конфигурация приложения находится в [`dinext_project_stage_gate/hooks.py`](dinext_project_stage_gate/hooks.py).

Ключевые настройки и точки интеграции:

- `required_apps = ["erpnext", "dinext_projects"]`
- `doctype_js`:
  - `Project -> public/js/project_stage_gate_project.js`
  - `Project Portfolio -> public/js/project_portfolio_stage_gate.js`
- `doc_events["Project"]`:
  - `validate` требует флаг `confirm_governance_reset` при смене/очистке `governance_model`, если есть активная цепочка
  - `before_save` выполняет отмену активной цепочки и инкремент `stage_chain_version` при подтверждённом сбросе
  - `after_insert` и `on_update` синхронизируют stage chain и summary-поля
- `doc_events["Project Stage Instance"]`:
  - `on_update` и `on_trash` пересчитывают summary-поля проекта
- экспорт fixtures для:
  - `Role`
  - `Custom Field`
  - `Custom DocPerm`
  - `Workflow`
  - `Workflow Action Master`
  - `Workflow State`
  - `Report`

Приложение опирается на site metadata и export-fixtures, а не на переменные окружения.

## ✅ Требования

- Рабочий Administrator
- Установленные приложения:
  - `frappe`
  - `erpnext`
  - `dinext_projects`
- Доступ к запуску `bench --site <site> migrate`
- Включенный developer mode при создании/обновлении DocType или metadata в базе данных

## 🤝 Вклад в проект

Перед внесением изменений установите и включите `pre-commit`:

```bash
cd apps/dinext_project_stage_gate
pre-commit install
```

В репозитории используются:

- `ruff`
- `eslint`
- `prettier`
- `pyupgrade`

Минимальная проверка перед публикацией изменений:

```bash
bench run-tests --app dinext_project_stage_gate
node --test tests/*.js
```

При изменении metadata-driven поведения придерживайтесь такого процесса:

1. Обновить код и metadata-файлы
2. Выполнить site migration
3. Запустить целевые тесты
4. Экспортировать fixtures

Проектные правила разработки находятся в [`AGENTS.md`](AGENTS.md).

## 📄 Документация

- [`README.md`](README.md) — обзор проекта на верхнем уровне
- [`AGENTS.md`](AGENTS.md) — проектная доктрина и правила работы с Frappe
- [`dinext_project_stage_gate/hooks.py`](dinext_project_stage_gate/hooks.py) — bootstrap приложения, fixtures и client script bindings
- [`dinext_project_stage_gate/stage_gate/api.py`](dinext_project_stage_gate/stage_gate/api.py) — whitelisted API
- [`dinext_project_stage_gate/stage_gate/checkpoint_provision.py`](dinext_project_stage_gate/stage_gate/checkpoint_provision.py) — создание checkpoint из шаблона при вставке `Project Stage Instance`
- [`dinext_project_stage_gate/stage_gate/project_hooks.py`](dinext_project_stage_gate/stage_gate/project_hooks.py) — orchestration layer для автоматического provisioning и пересчета summary
- [`dinext_project_stage_gate/stage_gate/query.py`](dinext_project_stage_gate/stage_gate/query.py) — read-model слой для виджета и отчета
- [`dinext_project_stage_gate/stage_gate/service.py`](dinext_project_stage_gate/stage_gate/service.py) — pure business logic для сборки stage chain и project summary
- [`dinext_project_stage_gate/stage_gate/working_days.py`](dinext_project_stage_gate/stage_gate/working_days.py) — расчет рабочих дат стадий с учетом holiday list
- [`dinext_project_stage_gate/dinext_project_stage_gate/doctype/project_gate_checkpoint/project_gate_checkpoint.js`](dinext_project_stage_gate/dinext_project_stage_gate/doctype/project_gate_checkpoint/project_gate_checkpoint.js) — клиентская логика чеклиста (удаление обязательных строк, скрытие «Удалить все строки»)
- [`dinext_project_stage_gate/dinext_project_stage_gate/doctype/project_gate_checkpoint/project_gate_checkpoint.py`](dinext_project_stage_gate/dinext_project_stage_gate/doctype/project_gate_checkpoint/project_gate_checkpoint.py) — валидация и синхронизация `checklist_completed` с чеклистом
- [`dinext_project_stage_gate/dinext_project_stage_gate/doctype/project_stage_instance/project_stage_instance.py`](dinext_project_stage_gate/dinext_project_stage_gate/doctype/project_stage_instance/project_stage_instance.py) — вычисление плановых/фактических дат и `after_insert` provisioning gate checkpoint
- [`dinext_project_stage_gate/public/js/project_portfolio_stage_gate.js`](dinext_project_stage_gate/public/js/project_portfolio_stage_gate.js) — shortcut из `Project Portfolio` в roadmap-отчет
- [`dinext_project_stage_gate/dinext_project_stage_gate/doctype/project_gate_checkpoint/test_project_gate_checkpoint.py`](dinext_project_stage_gate/dinext_project_stage_gate/doctype/project_gate_checkpoint/test_project_gate_checkpoint.py) — тесты пересчёта `checklist_completed`
- [`dinext_project_stage_gate/dinext_project_stage_gate/doctype/project_stage_instance/test_project_stage_instance.py`](dinext_project_stage_gate/dinext_project_stage_gate/doctype/project_stage_instance/test_project_stage_instance.py) — integration-тесты автосоздания и guard-логики
- [`tests/test_project_portfolio_stage_gate.test.js`](tests/test_project_portfolio_stage_gate.test.js) — JS regression-тест интеграции `Project Portfolio`
- [`tests/test_project_gate_checkpoint_form.test.js`](tests/test_project_gate_checkpoint_form.test.js) — JS regression-тест клиентских ограничений чеклиста
- [`tests/test_project_stage_gate_widget.test.js`](tests/test_project_stage_gate_widget.test.js) — JS regression-тест виджета `Project`
- [`tests/test_project_stage_gate_roadmap.test.js`](tests/test_project_stage_gate_roadmap.test.js) — JS regression-тест roadmap-отчета

## ❤️ Благодарности

- Frappe и ERPNext за metadata-driven платформу приложений
- `dinext_projects` за окружающий контекст проектов, портфелей и отчетности, с которым интегрируется это приложение

## 🗂️ Структура репозитория

```text
.
├── AGENTS.md
├── README.md
├── pyproject.toml
├── tests/
│   ├── test_project_gate_checkpoint_form.test.js
│   ├── test_project_portfolio_stage_gate.test.js
│   ├── test_project_stage_gate_roadmap.test.js
│   └── test_project_stage_gate_widget.test.js
└── dinext_project_stage_gate/
    ├── __init__.py
    ├── hooks.py
    ├── modules.txt
    ├── patches.txt
    ├── fixtures/
    │   ├── custom_docperm.json
    │   ├── custom_field.json
    │   ├── report.json
    │   ├── role.json
    │   ├── workflow.json
    │   ├── workflow_action_master.json
    │   └── workflow_state.json
    ├── public/
    │   ├── css/
    │   │   └── project_stage_gate.css
    │   └── js/
    │       ├── project_portfolio_stage_gate.js
    │       ├── project_stage_gate_project.js
    │       └── vendor/
    │           └── echarts.min.js
    ├── stage_gate/
    │   ├── api.py
    │   ├── checkpoint_provision.py
    │   ├── permissions.py
    │   ├── project_hooks.py
    │   ├── query.py
    │   ├── service.py
    │   ├── validators.py
    │   └── working_days.py
    ├── tests/
    │   ├── test_app_bootstrap.py
    │   ├── test_project_stage_gate_roadmap_report.py
    │   ├── test_stage_gate_api.py
    │   ├── test_stage_gate_permissions.py
    │   ├── test_stage_gate_query.py
    │   ├── test_stage_gate_service.py
    │   └── test_stage_gate_validators.py
    └── dinext_project_stage_gate/
        ├── doctype/
        │   ├── project_gate_checkpoint/
        │   ├── project_gate_checkpoint_level/
        │   ├── project_gate_checklist_item/
        │   ├── project_governance_model/
        │   ├── project_governance_model_stage/
        │   ├── project_stage/
        │   ├── project_stage_instance/
        │   ├── stage_gate_template/
        │   └── stage_gate_template_item/
        └── report/
            └── project_stage_gate_roadmap/
```

Пояснения к структуре:

- `dinext_project_stage_gate/dinext_project_stage_gate/doctype/` содержит metadata-backed определения DocType, контроллеры и тесты.
- `dinext_project_stage_gate/stage_gate/` содержит service/query/API, orchestration hooks, provisioning checkpoint и утилиты расчета рабочих дат.
- `dinext_project_stage_gate/public/` содержит UI-ассеты формы `Project`, shortcut для `Project Portfolio` и vendored ECharts stub.
- `dinext_project_stage_gate/fixtures/` хранит экспортированные metadata, необходимые для воспроизведения ролей, прав, workflow, отчетов и custom fields.
- `dinext_project_stage_gate/tests/` содержит точечные Python unit-тесты для service, query, API, permissions и report-поведения.
- `tests/` в корне репозитория содержит изолированные JavaScript regression-тесты для виджета `Project`, формы `Project Portfolio`, клиентской логики `Project Gate Checkpoint` и roadmap-отчета.

## 🔗 Схема потока

```mermaid
flowchart LR
  GovernanceModel[ProjectGovernanceModel]
  ModelStages[GovernanceModelStages]
  StageRegistry[ProjectStage]
  CheckpointLevels[ProjectGateCheckpointLevel]
  GateTemplate[StageGateTemplate]
  ProjectDoc[Project]
  ProjectHooks[stage_gate.project_hooks]
  StageInstances[ProjectStageInstance]
  Checkpoints[ProjectGateCheckpoint]
  Checklist[ProjectGateChecklistItem]
  QueryLayer[stage_gate.query]
  ProjectWidget[ProjectFormWidget]
  RoadmapReport[RoadmapScriptReport]

  GovernanceModel --> ModelStages
  ModelStages --> StageRegistry
  GateTemplate --> CheckpointLevels
  ProjectDoc --> ProjectHooks
  GovernanceModel --> ProjectHooks
  ProjectHooks --> StageInstances
  ProjectHooks --> ProjectDoc
  StageInstances --> Checkpoints
  GateTemplate --> Checkpoints
  Checkpoints --> Checklist
  StageInstances --> ProjectHooks
  StageInstances --> QueryLayer
  Checkpoints --> QueryLayer
  StageRegistry --> QueryLayer
  QueryLayer --> ProjectWidget
  QueryLayer --> RoadmapReport
```

Основной runtime-поток выглядит так:

1. Metadata DocType определяют модель управления, реестр стадий, уровни checkpoint и ExampleCustomer08 gate.
2. При сохранении `Project` hook-слой создает и синхронизирует `Project Stage Instance`, а контроллер стадии вычисляет плановые даты по рабочему календарю.
3. После вставки `Project Stage Instance` модуль provisioning создает `Project Gate Checkpoint`, если для стадии задан template.
4. Изменения самих `Project Stage Instance` также пересчитывают summary проекта через `doc_events`.
5. `stage_gate.query` собирает read-optimized datasets для виджета проекта и roadmap-отчета.
6. Клиентский код отрисовывает Stage-gate цепочку на форме `Project`, добавляет shortcut в `Project Portfolio` и строит roadmap chart в Script Report.
7. При сохранении `Project Gate Checkpoint` пересчитывается `checklist_completed` по статусам строк чеклиста; workflow checkpoint опирается на это поле для разрешения отправки на согласование.

## Лицензия

`mit`
