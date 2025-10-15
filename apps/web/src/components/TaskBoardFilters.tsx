import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface TaskBoardFiltersProps {
  projects: any[];
  selectedProject: string | null;
  onProjectChange: (value: string) => void;
  selectedPriority: string | null;
  onPriorityChange: (value: string) => void;
  selectedStatus: string | null;
  onStatusChange: (value: string) => void;
  selectedCategory: string | null;
  onCategoryChange: (value: string) => void;
}

export default function TaskBoardFilters({
  projects,
  selectedProject,
  onProjectChange,
  selectedPriority,
  onPriorityChange,
  selectedStatus,
  onStatusChange,
  selectedCategory,
  onCategoryChange
}: TaskBoardFiltersProps) {
  return (
    <div className="flex items-center gap-4">
      <Label className="text-muted-foreground font-medium">Filters:</Label>
      
      {/* Project Filter */}
      <Select value={selectedProject || "all"} onValueChange={onProjectChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Checkbox checked={selectedProject === "all" || !selectedProject} />
              <span>Select All</span>
            </div>
          </SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id.toString()}>
              <div className="flex items-center gap-2">
                <Checkbox checked={selectedProject === project.id.toString()} />
                <span>{project.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Priority Filter */}
      <Select value={selectedPriority || "all"} onValueChange={onPriorityChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Checkbox checked={selectedPriority === "all" || !selectedPriority} />
              <span>Select All</span>
            </div>
          </SelectItem>
          <SelectItem value="high">
            <div className="flex items-center gap-2">
              <Checkbox checked={selectedPriority === "high"} />
              <span>high</span>
            </div>
          </SelectItem>
          <SelectItem value="medium">
            <div className="flex items-center gap-2">
              <Checkbox checked={selectedPriority === "medium"} />
              <span>medium</span>
            </div>
          </SelectItem>
          <SelectItem value="low">
            <div className="flex items-center gap-2">
              <Checkbox checked={selectedPriority === "low"} />
              <span>low</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select value={selectedStatus || "all"} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Checkbox checked={selectedStatus === "all" || !selectedStatus} />
              <span>Select All</span>
            </div>
          </SelectItem>
          <SelectItem value="todo">
            <div className="flex items-center gap-2">
              <Checkbox checked={selectedStatus === "todo"} />
              <span>To Do</span>
            </div>
          </SelectItem>
          <SelectItem value="in_progress">
            <div className="flex items-center gap-2">
              <Checkbox checked={selectedStatus === "in_progress"} />
              <span>In Progress</span>
            </div>
          </SelectItem>
          <SelectItem value="done">
            <div className="flex items-center gap-2">
              <Checkbox checked={selectedStatus === "done"} />
              <span>Done</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Category Filter */}
      <Select value={selectedCategory || "all"} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Checkbox checked={selectedCategory === "all" || !selectedCategory} />
              <span>Select All</span>
            </div>
          </SelectItem>
          {/* Add more categories as needed */}
        </SelectContent>
      </Select>
    </div>
  );
}