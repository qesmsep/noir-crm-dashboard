-- enable uuid extension if not already
create extension if not exists "uuid-ossp";

-- Goals table: represents top-level nodes (quarter or year)
create table if not exists public.goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users (id) on delete cascade,
  period text not null check (period in ('quarter', 'year')),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tasks table: max 3-level hierarchy
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete cascade,
  parent_id uuid references public.tasks (id) on delete cascade,
  title text not null,
  objective text,
  focus text check (focus in ('speed','cost','quality')) default 'speed',
  nested_rank int default 0,      -- order within siblings (0 = top)
  global_rank int default 0,      -- company-wide order
  deadline date,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Task notes: free-form rich text notes per task
create table if not exists public.task_notes (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references public.tasks (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Create indexes for performant lookups
create index if not exists idx_tasks_user_id on public.tasks (user_id);
create index if not exists idx_goals_user_id on public.goals (user_id);
create index if not exists idx_task_notes_task_id on public.task_notes (task_id);

-- Enable Row Level Security
alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.task_notes enable row level security;

-- Goals RLS policies
create policy "Goals: Select own" on public.goals
  for select using (auth.uid() = user_id);
create policy "Goals: Insert own" on public.goals
  for insert with check (auth.uid() = user_id);
create policy "Goals: Update own" on public.goals
  for update using (auth.uid() = user_id);
create policy "Goals: Delete own" on public.goals
  for delete using (auth.uid() = user_id);

-- Tasks RLS policies
create policy "Tasks: Select own" on public.tasks
  for select using (auth.uid() = user_id);
create policy "Tasks: Insert own" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "Tasks: Update own" on public.tasks
  for update using (auth.uid() = user_id);
create policy "Tasks: Delete own" on public.tasks
  for delete using (auth.uid() = user_id);

-- Task notes RLS policies
create policy "TaskNotes: Select own" on public.task_notes
  for select using (auth.uid() = user_id);
create policy "TaskNotes: Insert own" on public.task_notes
  for insert with check (auth.uid() = user_id);
create policy "TaskNotes: Update own" on public.task_notes
  for update using (auth.uid() = user_id);
create policy "TaskNotes: Delete own" on public.task_notes
  for delete using (auth.uid() = user_id);