---
description: Interact with AI Together (Libe Aios) system — manage projects, modules, tasks, comments, and more via MCP
---

// turbo-all

# /libeaios — AI Together System Control

When the user invokes `/libeaios` followed by a request in natural language, you should use the **libe-aios MCP tools** to fulfill that request.

## How It Works

The user types something like:
- `/libeaios xem danh sách project`
- `/libeaios tạo module "Backend API" cho project PROJ-001`
- `/libeaios comment vào module MOD-005: đã hoàn thành`
- `/libeaios xem task của tôi`
- `/libeaios upload link vào project PROJ-001`

You should:
1. **Parse** the user's intent from their natural language request
2. **Call the correct MCP tool** (from the `libe-aios` MCP server)
3. **Present the result** in a clean, readable format (tables, lists, etc.)

## Available MCP Tools

### Projects
| Tool | Description |
|------|-------------|
| `get_projects` | List all projects |
| `get_project` | Get details of a specific project (needs `projectId`) |
| `create_project` | Create a new project (needs `title`) |
| `update_project` | Update project (needs `projectId`, chairman/admin only) |
| `delete_project` | Delete project (chairman/admin only) |
| `add_project_member` | Add user to project team |
| `remove_project_member` | Remove user from project team |
| `sync_github_commits` | Sync commits from linked GitHub repo |

### Modules
| Tool | Description |
|------|-------------|
| `get_modules` | List modules in a project (needs `projectId`) |
| `get_my_modules` | List my assigned modules |
| `get_module` | Get module details (needs `moduleId`) |
| `create_module` | Create module (needs `projectId`, `title`) |
| `update_module` | Update module details |
| `update_module_status` | Change status: planned, in_progress, in_review, changes_requested, done |
| `delete_module` | Delete module and related data |

### Tasks
| Tool | Description |
|------|-------------|
| `get_tasks` | List tasks in a module (needs `moduleId`) |
| `get_my_tasks` | List my assigned tasks |
| `create_task` | Create task (needs `moduleId`, `title`) |
| `update_task` | Update task details |
| `update_task_status` | Change status: todo, in_progress, in_review, done |
| `delete_task` | Delete a task |

### Comments
| Tool | Description |
|------|-------------|
| `get_comments` | Get comments on a module/task (needs `targetType`, `targetId`) |
| `add_comment` | Add comment (needs `targetType`, `targetId`, `content`) |
| `delete_comment` | Delete comment |

### Documents
| Tool | Description |
|------|-------------|
| `list_documents` | List documents attached to a target |
| `attach_link` | Attach a URL as document |
| `delete_document` | Delete a document |

### Reviews & Notifications
| Tool | Description |
|------|-------------|
| `submit_review` | Review a module (chairman/admin only) |
| `get_notifications` | Get my notifications |
| `mark_notification_read` | Mark notifications as read |

### Dashboard & Users
| Tool | Description |
|------|-------------|
| `get_dashboard` | System stats (project/module/task/user counts) |
| `get_users` | List all users |
| `get_me` | Get current user info |

## Presentation Guidelines

- **Lists**: Format results as markdown tables for readability
- **Success**: Confirm actions with ✅ and show the created/updated item
- **Errors**: Show ❌ with clear error message
- **Vietnamese**: Respond in Vietnamese if the user uses Vietnamese
- **Context**: Remember IDs from previous calls to avoid asking the user again

## Example Interactions

**User**: `/libeaios xem danh sách project`
**You**: Call `get_projects`, then display as table with columns: ID, Title, Status, PM, Members, Deadline

**User**: `/libeaios tạo module "Backend API" cho project PROJ-001, gán cho user Phương`
**You**: 
1. Call `get_users` to find Phương's user ID
2. Call `create_module` with projectId, title, assigneeId
3. Confirm: ✅ Module MOD-XXX created

**User**: `/libeaios comment vào MOD-005: đã hoàn thành phần backend`
**You**: Call `add_comment` with targetType="module", targetId="MOD-005", content="đã hoàn thành phần backend"
