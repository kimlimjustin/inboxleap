import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Plus, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Calendar,
  User,
  Mail
} from 'lucide-react';
import { motion } from 'framer-motion';
import KanbanColumn from './KanbanColumn';
import TaskCard from './TaskCard';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in-progress' | 'review' | 'done';
  assignee?: {
    name: string;
    email: string;
    avatar?: string;
  };
  dueDate?: string;
  createdFrom?: {
    type: 'email';
    from: string;
    subject: string;
  };
  tags: string[];
}

const initialTasks: Task[] = [
  {
    id: '1',
    title: 'Review Q4 Budget Proposal',
    description: 'Review and provide feedback on the Q4 budget proposal sent by finance team.',
    priority: 'high',
    status: 'todo',
    assignee: {
      name: 'John Doe',
      email: 'john@company.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john'
    },
    dueDate: '2024-01-15',
    createdFrom: {
      type: 'email',
      from: 'finance@company.com',
      subject: 'Q4 Budget Proposal for Review'
    },
    tags: ['finance', 'budget', 'review']
  },
  {
    id: '2',
    title: 'Update Product Roadmap',
    description: 'Incorporate feedback from stakeholder meeting into product roadmap.',
    priority: 'medium',
    status: 'in-progress',
    assignee: {
      name: 'Jane Smith',
      email: 'jane@company.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane'
    },
    dueDate: '2024-01-20',
    createdFrom: {
      type: 'email',
      from: 'stakeholders@company.com',
      subject: 'Roadmap Feedback from Meeting'
    },
    tags: ['product', 'roadmap', 'planning']
  },
  {
    id: '3',
    title: 'Prepare Sales Report',
    description: 'Compile monthly sales data and prepare presentation for board meeting.',
    priority: 'urgent',
    status: 'review',
    assignee: {
      name: 'Mike Johnson',
      email: 'mike@company.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mike'
    },
    dueDate: '2024-01-12',
    createdFrom: {
      type: 'email',
      from: 'board@company.com',
      subject: 'Sales Report Needed for Board Meeting'
    },
    tags: ['sales', 'report', 'board']
  },
  {
    id: '4',
    title: 'Customer Feedback Analysis',
    description: 'Analyze customer feedback from recent survey and identify action items.',
    priority: 'low',
    status: 'done',
    assignee: {
      name: 'Sarah Wilson',
      email: 'sarah@company.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah'
    },
    dueDate: '2024-01-10',
    createdFrom: {
      type: 'email',
      from: 'customer-success@company.com',
      subject: 'Survey Results Ready for Analysis'
    },
    tags: ['customer', 'feedback', 'analysis']
  }
];

const columns = [
  {
    id: 'todo',
    title: 'To Do',
    color: 'bg-blue-500',
    icon: Clock,
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    color: 'bg-yellow-500',
    icon: AlertCircle,
  },
  {
    id: 'review',
    title: 'Review',
    color: 'bg-purple-500',
    icon: CheckCircle,
  },
  {
    id: 'done',
    title: 'Done',
    color: 'bg-green-500',
    icon: CheckCircle,
  },
];

const KanbanBoard = () => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(task => task.id === active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const activeTask = tasks.find(task => task.id === active.id);
    const overColumn = over.id as Task['status'];

    if (activeTask && activeTask.status !== overColumn) {
      setTasks(tasks.map(task => 
        task.id === active.id 
          ? { ...task, status: overColumn }
          : task
      ));
    }

    setActiveTask(null);
  };

  const getTasksByStatus = (status: Task['status']) => {
    return tasks.filter(task => task.status === status);
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Board Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Team Tasks</h3>
          <div className="flex gap-2">
            {columns.map(column => (
              <Badge key={column.id} variant="outline" className="gap-1">
                <div className={`w-2 h-2 rounded-full ${column.color}`} />
                {getTasksByStatus(column.id as Task['status']).length}
              </Badge>
            ))}
          </div>
        </div>
        <Button size="sm" className="bg-gradient-primary hover:shadow-glow">
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {columns.map(column => {
            const columnTasks = getTasksByStatus(column.id as Task['status']);
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={columnTasks}
              />
            );
          })}
        </div>
        
        <DragOverlay>
          {activeTask ? (
            <div className="rotate-6 opacity-90">
              <TaskCard task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Due This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">3</div>
            <p className="text-xs text-muted-foreground">Tasks need attention</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              My Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{tasks.length}</div>
            <p className="text-xs text-muted-foreground">Total assigned to you</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              From Emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {tasks.filter(t => t.createdFrom?.type === 'email').length}
            </div>
            <p className="text-xs text-muted-foreground">Created by agents</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KanbanBoard;