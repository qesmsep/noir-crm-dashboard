'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import { Plus, Edit2, Trash2, GripVertical, Eye } from 'lucide-react';

interface Question {
  id?: string;
  question_text: string;
  question_type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file';
  placeholder?: string;
  options?: { value: string; label: string }[];
  is_required: boolean;
  order_index: number;
}

interface Questionnaire {
  id?: string;
  title: string;
  description: string;
  type: 'waitlist' | 'membership' | 'custom';
  is_active: boolean;
  questionnaire_questions?: Question[];
}

export default function QuestionnaireBuilder() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<Questionnaire | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isQuestionOpen, setIsQuestionOpen] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadQuestionnaires();
  }, []);

  const loadQuestionnaires = async () => {
    try {
      const response = await fetch('/api/questionnaires');
      if (response.ok) {
        const data = await response.json();
        setQuestionnaires(data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load questionnaires',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestionnaire = () => {
    setSelectedQuestionnaire({
      title: '',
      description: '',
      type: 'waitlist',
      is_active: true,
    });
    setQuestions([]);
    setIsOpen(true);
  };

  const handleEditQuestionnaire = async (questionnaire: Questionnaire) => {
    setSelectedQuestionnaire(questionnaire);

    if (questionnaire.id) {
      try {
        const response = await fetch(`/api/questionnaires/${questionnaire.id}/questions`);
        if (response.ok) {
          const data = await response.json();
          setQuestions(data);
        }
      } catch (error) {
        console.error('Failed to load questions:', error);
      }
    }

    setIsOpen(true);
  };

  const handleSaveQuestionnaire = async () => {
    if (!selectedQuestionnaire) return;

    try {
      const method = selectedQuestionnaire.id ? 'PUT' : 'POST';
      const url = selectedQuestionnaire.id
        ? `/api/questionnaires/${selectedQuestionnaire.id}`
        : '/api/questionnaires';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedQuestionnaire,
          questions
        })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Questionnaire ${selectedQuestionnaire.id ? 'updated' : 'created'}`,
        });
        loadQuestionnaires();
        setIsOpen(false);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save questionnaire',
        variant: 'error',
      });
    }
  };

  const handleAddQuestion = () => {
    setEditingQuestion({
      question_text: '',
      question_type: 'text',
      placeholder: '',
      is_required: false,
      order_index: questions.length + 1
    });
    setIsQuestionOpen(true);
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setIsQuestionOpen(true);
  };

  const handleSaveQuestion = () => {
    if (!editingQuestion) return;

    const existingIndex = questions.findIndex(q => q.order_index === editingQuestion.order_index);

    if (existingIndex >= 0) {
      const updated = [...questions];
      updated[existingIndex] = editingQuestion;
      setQuestions(updated);
    } else {
      setQuestions([...questions, editingQuestion]);
    }

    setIsQuestionOpen(false);
    setEditingQuestion(null);
  };

  const handleDeleteQuestion = (orderIndex: number) => {
    setQuestions(questions.filter(q => q.order_index !== orderIndex));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newQuestions.length) return;

    [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];

    newQuestions.forEach((q, i) => {
      q.order_index = i + 1;
    });

    setQuestions(newQuestions);
  };

  const getQuestionTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      text: '📝',
      email: '📧',
      phone: '📞',
      textarea: '📄',
      select: '📋',
      radio: '🔘',
      checkbox: '☑️',
      file: '📎'
    };
    return icons[type] || '❓';
  };

  if (loading) {
    return <div className="text-text-muted">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg md:text-xl font-bold text-[#1F1F1F]">
            Questionnaire Builder
          </h2>
          <p className="text-xs md:text-sm text-text-muted">
            Create beautiful, custom forms to replace Typeform
          </p>
        </div>
        <Button
          onClick={handleCreateQuestionnaire}
          className="bg-cork text-white hover:bg-cork-dark rounded-lg font-semibold shadow-lg text-sm px-3 py-2"
        >
          <Plus className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">Create Form</span>
        </Button>
      </div>

      {/* Questionnaires List */}
      {questionnaires.length === 0 ? (
        <Card className="bg-white rounded-lg border border-border-cream-1 p-6 md:p-8 text-center">
          <div className="text-2xl md:text-3xl mb-2">📋</div>
          <h3 className="text-base md:text-lg font-semibold text-[#1F1F1F] mb-1">No questionnaires yet</h3>
          <p className="text-xs md:text-sm text-text-muted mb-4">
            Create your first questionnaire to start collecting responses
          </p>
          <Button
            onClick={handleCreateQuestionnaire}
            className="bg-cork text-white hover:bg-cork-dark rounded-lg font-semibold shadow-lg text-sm px-3 py-2"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create First Questionnaire
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {questionnaires.map((q) => (
            <Card
              key={q.id}
              className="bg-white rounded-lg border border-border-cream-1 shadow-sm hover:shadow-md transition-shadow cursor-pointer p-3"
            >
              <div className="flex justify-between items-start gap-2">
                {/* Left side */}
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm md:text-base font-semibold text-[#1F1F1F]">
                      {q.title}
                    </h3>
                    <Badge
                      className={`text-2xs px-1.5 py-0.5 rounded ${
                        q.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-[#DAD7D0] text-text-muted'
                      }`}
                    >
                      {q.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge className="text-2xs px-1.5 py-0.5 rounded bg-cork text-white capitalize">
                      {q.type}
                    </Badge>
                  </div>

                  {q.description && (
                    <p className="text-xs md:text-sm text-text-muted line-clamp-1">
                      {q.description}
                    </p>
                  )}

                  <p className="text-2xs text-[#8C7C6D] font-medium">
                    {q.questionnaire_questions?.length || 0} questions
                  </p>
                </div>

                {/* Right side - Actions */}
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditQuestionnaire(q)}
                    className="h-8 w-8 hover:bg-bg-cream-1"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-bg-cream-1 hidden md:flex"
                    title="Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-red-50 hover:text-red-600 hidden md:flex"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Questionnaire Editor Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[450px] overflow-y-auto bg-white p-4">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-lg font-semibold text-[#1F1F1F]">
              {selectedQuestionnaire?.id ? 'Edit' : 'Create'} Questionnaire
            </SheetTitle>
            <SheetDescription className="text-xs text-text-muted">
              Design your form questions and settings
            </SheetDescription>
          </SheetHeader>

          <div className="mt-3 flex flex-col gap-3">
            {/* Basic Info Card */}
            <Card className="bg-white border border-border-cream-1 shadow-sm p-3">
              <div className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="title" className="text-xs font-semibold text-[#1F1F1F]">
                    Form Title*
                  </Label>
                  <Input
                    id="title"
                    value={selectedQuestionnaire?.title || ''}
                    onChange={(e) =>
                      setSelectedQuestionnaire({
                        ...selectedQuestionnaire!,
                        title: e.target.value
                      })
                    }
                    placeholder="e.g., Invitation Request"
                    className="mt-1 text-sm h-9"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-xs font-semibold text-[#1F1F1F]">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={selectedQuestionnaire?.description || ''}
                    onChange={(e) =>
                      setSelectedQuestionnaire({
                        ...selectedQuestionnaire!,
                        description: e.target.value
                      })
                    }
                    placeholder="Waitlist application for prospective members"
                    rows={2}
                    className="mt-1 text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="type" className="text-xs font-semibold text-[#1F1F1F]">
                    Form Type
                  </Label>
                  <Select
                    id="type"
                    value={selectedQuestionnaire?.type || 'waitlist'}
                    onChange={(e) =>
                      setSelectedQuestionnaire({
                        ...selectedQuestionnaire!,
                        type: e.target.value as any
                      })
                    }
                    className="mt-1 text-sm h-9"
                  >
                    <option value="waitlist">Waitlist</option>
                    <option value="membership">Membership Application</option>
                    <option value="custom">Custom</option>
                  </Select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Label htmlFor="active" className="text-xs font-semibold text-[#1F1F1F]">
                    Active
                  </Label>
                  <Switch
                    id="active"
                    checked={selectedQuestionnaire?.is_active}
                    onCheckedChange={(checked) =>
                      setSelectedQuestionnaire({
                        ...selectedQuestionnaire!,
                        is_active: checked
                      })
                    }
                  />
                </div>
              </div>
            </Card>

            {/* Questions Section */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="text-xs font-semibold text-[#1F1F1F]">
                    Questions ({questions.length})
                  </p>
                  <p className="text-2xs text-text-muted">
                    Click to edit • Drag to reorder
                  </p>
                </div>
                <Button
                  onClick={handleAddQuestion}
                  className="bg-cork text-white hover:bg-cork-dark text-xs px-2 py-1 h-7"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>

              <div className="flex flex-col gap-1.5">
                {questions.sort((a, b) => a.order_index - b.order_index).map((question, index) => (
                  <Card
                    key={question.order_index}
                    className="bg-white border border-border-cream-1 shadow-sm hover:bg-[#FBFBFA] hover:border-[#DAD7D0] transition-all cursor-pointer p-2"
                    onClick={() => handleEditQuestion(question)}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex gap-1.5 flex-1 min-w-0">
                        <span className="text-sm leading-none">
                          {getQuestionTypeIcon(question.question_type)}
                        </span>
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className="bg-[#1F1F1F] text-white text-2xs px-1 py-0 rounded">
                              #{question.order_index}
                            </Badge>
                            <span className="text-xs font-medium text-[#1F1F1F] truncate">
                              {question.question_text}
                            </span>
                            {question.is_required && (
                              <Badge className="bg-red-600 text-white text-2xs px-1 py-0 rounded">
                                Required
                              </Badge>
                            )}
                          </div>
                          <span className="text-2xs text-[#8C7C6D]">
                            {question.question_type}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveQuestion(index, 'up')}
                          disabled={index === 0}
                          className="h-6 w-6"
                        >
                          <GripVertical className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveQuestion(index, 'down')}
                          disabled={index === questions.length - 1}
                          className="h-6 w-6"
                        >
                          <GripVertical className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteQuestion(question.order_index)}
                          className="h-6 w-6 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}

                {questions.length === 0 && (
                  <Card className="bg-white border-2 border-dashed border-border-cream-1 py-4 text-center">
                    <div className="text-xl mb-1">📝</div>
                    <p className="text-xs font-medium text-[#1F1F1F] mb-0.5">
                      No questions yet
                    </p>
                    <p className="text-2xs text-text-muted">
                      Click "Add" to get started
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </div>

          <SheetFooter className="mt-4 pt-3 border-t gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="text-sm h-8"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveQuestionnaire}
              className="text-sm h-8"
            >
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Question Editor Sheet */}
      <Sheet open={isQuestionOpen} onOpenChange={setIsQuestionOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[400px] overflow-y-auto bg-white p-4">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-lg font-semibold text-[#1F1F1F]">
              {editingQuestion?.id ? 'Edit' : 'Add'} Question
            </SheetTitle>
            <SheetDescription className="text-xs text-text-muted">
              Configure your question details
            </SheetDescription>
          </SheetHeader>

          <div className="mt-3 flex flex-col gap-3">
            <div>
              <Label htmlFor="question-text" className="text-xs font-semibold text-[#1F1F1F]">
                Question Text*
              </Label>
              <Input
                id="question-text"
                value={editingQuestion?.question_text || ''}
                onChange={(e) =>
                  setEditingQuestion({
                    ...editingQuestion!,
                    question_text: e.target.value
                  })
                }
                placeholder="e.g., What is your email address?"
                className="mt-1 text-sm h-9"
              />
            </div>

            <div>
              <Label htmlFor="question-type" className="text-xs font-semibold text-[#1F1F1F]">
                Question Type*
              </Label>
              <Select
                id="question-type"
                value={editingQuestion?.question_type || 'text'}
                onChange={(e) =>
                  setEditingQuestion({
                    ...editingQuestion!,
                    question_type: e.target.value as any
                  })
                }
                className="mt-1 text-sm h-9"
              >
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="textarea">Long Text</option>
                <option value="select">Dropdown</option>
                <option value="radio">Multiple Choice</option>
                <option value="checkbox">Checkboxes</option>
                <option value="file">File Upload</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="placeholder" className="text-xs font-semibold text-[#1F1F1F]">
                Placeholder Text
              </Label>
              <Input
                id="placeholder"
                value={editingQuestion?.placeholder || ''}
                onChange={(e) =>
                  setEditingQuestion({
                    ...editingQuestion!,
                    placeholder: e.target.value
                  })
                }
                placeholder="e.g., your@email.com"
                className="mt-1 text-sm h-9"
              />
            </div>

            {(editingQuestion?.question_type === 'select' ||
              editingQuestion?.question_type === 'radio' ||
              editingQuestion?.question_type === 'checkbox') && (
              <div>
                <Label htmlFor="options" className="text-xs font-semibold text-[#1F1F1F]">
                  Options (one per line)
                </Label>
                <Textarea
                  id="options"
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  rows={4}
                  onChange={(e) => {
                    const lines = e.target.value.split('\n').filter(l => l.trim());
                    const options = lines.map((line, i) => ({
                      value: `option${i + 1}`,
                      label: line.trim()
                    }));
                    setEditingQuestion({
                      ...editingQuestion!,
                      options
                    });
                  }}
                  value={editingQuestion?.options?.map(o => o.label).join('\n') || ''}
                  className="mt-1 text-xs"
                />
              </div>
            )}

            <Card className={`border ${editingQuestion?.is_required ? 'border-red-600' : 'border-border-cream-1'} bg-white shadow-sm p-2.5`}>
              <div className="flex items-center justify-between">
                <Label htmlFor="required" className="text-xs font-semibold text-[#1F1F1F]">
                  Required field
                </Label>
                <Switch
                  id="required"
                  checked={editingQuestion?.is_required}
                  onCheckedChange={(checked) =>
                    setEditingQuestion({
                      ...editingQuestion!,
                      is_required: checked
                    })
                  }
                />
              </div>
            </Card>
          </div>

          <SheetFooter className="mt-4 pt-3 border-t gap-2">
            <Button
              variant="outline"
              onClick={() => setIsQuestionOpen(false)}
              className="text-sm h-8"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveQuestion}
              className="text-sm h-8"
            >
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
