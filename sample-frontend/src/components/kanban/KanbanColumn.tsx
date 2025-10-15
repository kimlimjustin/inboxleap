import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import TaskCard from './TaskCard';
import { Task } from './KanbanBoard';

interface Column {
  id: string;
  title: string;
  color: string;
  icon: React.ElementType;
}

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
}

const KanbanColumn = ({ column, tasks }: KanbanColumnProps) => {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const IconComponent = column.icon;

  return (
    <div className="space-y-4">
      {/* Column Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${column.color}`} />
          <h3 className="font-semibold text-sm">{column.title}</h3>
          <Badge variant="secondary" className="text-xs">
            {tasks.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Droppable Area */}
      <div
        ref={setNodeRef}
        className="min-h-[200px] space-y-3 p-2 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/20"
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
        
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <IconComponent className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No tasks in {column.title.toLowerCase()}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;