import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  MoreVertical, 
  Calendar, 
  Mail, 
  Clock,
  AlertTriangle,
  User
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Task } from './KanbanBoard';

interface TaskCardProps {
  task: Task;
}

const TaskCard = ({ task }: TaskCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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

  const getPriorityIcon = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="h-3 w-3" />;
      case 'high':
        return <Clock className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab ${isDragging ? 'opacity-50' : ''}`}
    >
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="hover:shadow-md transition-shadow border-0 shadow-soft">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-sm font-medium line-clamp-2 mb-1">
                  {task.title}
                </CardTitle>
                <CardDescription className="text-xs line-clamp-2">
                  {task.description}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-2">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="flex items-center gap-1 mt-2">
              <Badge 
                variant="outline" 
                className={`text-xs px-2 py-0 ${getPriorityColor(task.priority)}`}
              >
                {getPriorityIcon(task.priority)}
                <span className="ml-1 capitalize">{task.priority}</span>
              </Badge>
              {isOverdue && (
                <Badge variant="destructive" className="text-xs px-2 py-0">
                  Overdue
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-0 space-y-3">
            {/* Tags */}
            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {task.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
                {task.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    +{task.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}

            {/* Due Date */}
            {task.dueDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                  Due {new Date(task.dueDate).toLocaleDateString()}
                </span>
              </div>
            )}

            {/* Created From Email */}
            {task.createdFrom && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span className="truncate">
                  From: {task.createdFrom.from.split('@')[0]}
                </span>
              </div>
            )}

            {/* Assignee */}
            {task.assignee && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={task.assignee.avatar} />
                    <AvatarFallback className="text-xs">
                      {task.assignee.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground truncate">
                    {task.assignee.name}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default TaskCard;