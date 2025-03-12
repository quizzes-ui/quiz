import React, { useState, useRef } from 'react';
import { balanceCorrectAnswers } from '../utils/quizUtils';
import { TrashIcon, UploadIcon, InfoIcon, CheckIcon } from './Icons';

const ManageQuizzes = ({ onClose, onQuizActivated, quizzes = [], setQuizzes }) => {
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showQuizDetails, setShowQuizDetails] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState(null);
  const [toggleLoadingId, setToggleLoadingId] = useState(null);
  const fileInputRef = useRef(null);

  const removeQuestion = (quizId, questionId) => {
    setQuizzes(prevQuizzes => {
      return prevQuizzes.map(quiz => {
        if (quiz.id === quizId) {
          // Create a new quiz object with the question removed
          const updatedQuestions = quiz.data.questions.filter(question => question.id !== questionId);
          
          return {
            ...quiz,
            data: {
              ...quiz.data,
              questions: updatedQuestions
            }
          };
        }
        return quiz;
      });
    });
    
    // If we're currently viewing this quiz, update the selectedQuiz state
    if (selectedQuiz && selectedQuiz.id === quizId) {
      const updatedQuestions = selectedQuiz.data.questions.filter(question => question.id !== questionId);
      setSelectedQuiz({
        ...selectedQuiz,
        data: {
          ...selectedQuiz.data,
          questions: updatedQuestions
        }
      });
    }
    
    // If the quiz is active, update the active quiz
    const quiz = quizzes.find(q => q.id === quizId);
    if (quiz && quiz.isActive) {
      const activeQuizzes = quizzes.filter(q => q.isActive);
      
      if (activeQuizzes.length === 1) {
        // Only this quiz is active, update it
        const updatedQuestions = quiz.data.questions.filter(q => q.id !== questionId);
        onQuizActivated({
          ...quiz.data,
          questions: updatedQuestions
        });
      } else if (activeQuizzes.length > 1) {
        // Multiple quizzes are active, update the combined quiz
        const combinedQuestions = [];
        activeQuizzes.forEach(activeQuiz => {
          if (activeQuiz.id === quizId) {
            // For the quiz we're modifying, filter out the removed question
            const filteredQuestions = activeQuiz.data.questions.filter(q => q.id !== questionId);
            combinedQuestions.push(...filteredQuestions);
          } else {
            // For other quizzes, include all questions
            combinedQuestions.push(...activeQuiz.data.questions);
          }
        });
        
        onQuizActivated({
          title: "Combo Quiz",
          questions: combinedQuestions
        });
      }
    }
  };



  const addIdsToQuestions = (data) => {
    // Clone the data to avoid mutating the original
    const processedData = { ...data };
    
    // Add IDs to questions if they don't have one
    if (processedData.questions && Array.isArray(processedData.questions)) {
      processedData.questions = processedData.questions.map((question, index) => {
        // If question doesn't have an ID, add one
        if (!question.id) {
          return {
            ...question,
            id: `q-${Date.now()}-${index}`  // Create a unique ID using timestamp and index
          };
        }
        return question;
      });
    }
    
    return processedData;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    setUploadError('');
    setUploadSuccess('');

    if (!file) return;

    try {
      // Read file content
      const fileContent = await file.text();
      
      // Parse JSON without validation
      let parsedData = JSON.parse(fileContent);
      
      // Add IDs to questions if they don't have them
      parsedData = addIdsToQuestions(parsedData);
      
      // Balance the correct answers distribution
      parsedData = balanceCorrectAnswers(parsedData);

      // Create and add the new quiz
      const newQuiz = {
        id: Date.now().toString(),
        title: parsedData.title || 'Untitled Quiz',
        data: parsedData,
        isActive: true,
        dateAdded: new Date().toISOString()
      };
      
      setQuizzes(prevQuizzes => {
        const updatedQuizzes = (prevQuizzes || []).map(quiz => 
          quiz ? {
            ...quiz,
            isActive: false
          } : null
        ).filter(Boolean);
        
        return [newQuiz, ...updatedQuizzes];
      });

      // Order modes logic has been removed
      
      onQuizActivated(parsedData);
    } catch (error) {
      console.error('File processing error:', error);
    }

    if (event.target) {
      event.target.value = '';
    }
  };

  const handleDelete = (quizId) => {
    if (quizToDelete === quizId) {
      // Second click - confirm deletion
      setQuizzes(prevQuizzes => {
        const updatedQuizzes = (prevQuizzes || []).filter(quiz => quiz?.id !== quizId);
        const deletedQuiz = quizzes.find(q => q?.id === quizId);
        const wasActive = deletedQuiz?.isActive;
        
        // If no quizzes remain, deactivate all
        if (updatedQuizzes.length === 0) {
          onQuizActivated(null);
          return updatedQuizzes;
        }
        
        // If the deleted quiz was active, we need to update the active quiz
        if (wasActive) {
          // Find remaining active quizzes
          const activeQuizzes = updatedQuizzes.filter(quiz => quiz.isActive);
          
          // If no active quizzes remain, activate the first one
          if (activeQuizzes.length === 0 && updatedQuizzes.length > 0) {
            updatedQuizzes[0].isActive = true;
            onQuizActivated(updatedQuizzes[0].data);
          } else if (activeQuizzes.length === 1) {
            // Only one active quiz remains, use it
            onQuizActivated(activeQuizzes[0].data);
          } else if (activeQuizzes.length > 1) {
            // Multiple active quizzes, combine them
            const combinedQuestions = [];
            activeQuizzes.forEach(quiz => {
              if (quiz.data && quiz.data.questions) {
                combinedQuestions.push(...quiz.data.questions);
              }
            });
            
            onQuizActivated({
              title: "Combo Quiz",
              questions: combinedQuestions
            });
          }
        }
        
        return updatedQuizzes;
      });
      setQuizToDelete(null);
    } else {
      // First click - set quiz to be deleted
      setQuizToDelete(quizId);
      
      // Auto-reset the delete state after a timeout
      setTimeout(() => {
        setQuizToDelete(prevId => prevId === quizId ? null : prevId);
      }, 3000);
    }
  };

  const handleToggleActive = (quizId) => {
    // Set loading state for this row
    setToggleLoadingId(quizId);
    
    setQuizzes(prevQuizzes => {
      const updatedQuizzes = (prevQuizzes || []).map(quiz => {
        if (quiz && quiz.id === quizId) {
          return {
            ...quiz,
            isActive: !quiz.isActive
          };
        }
        return quiz;
      }).filter(Boolean);
      
      // Check if any quiz is active
      const activeQuizzes = updatedQuizzes.filter(quiz => quiz.isActive);
      
      // If no active quizzes, deactivate all
      if (activeQuizzes.length === 0) {
        onQuizActivated(null);
        return updatedQuizzes;
      }
      
      // If only one quiz is active, use its data directly
      if (activeQuizzes.length === 1) {
        onQuizActivated(activeQuizzes[0].data);
        return updatedQuizzes;
      }
      
      // If multiple quizzes are active, combine their questions
      const combinedQuestions = [];
      activeQuizzes.forEach(quiz => {
        if (quiz.data && quiz.data.questions && Array.isArray(quiz.data.questions)) {
          combinedQuestions.push(...quiz.data.questions);
        }
      });
      
      // Create a combined quiz with all questions
      const combinedQuiz = {
        title: "Combo Quiz",
        questions: combinedQuestions
      };
      
      onQuizActivated(combinedQuiz);
      return updatedQuizzes;
    });
    
    // Clear loading state after the state update
    setTimeout(() => {
      setToggleLoadingId(null);
    }, 300); // Short delay to show the spinner
  };
  
  const viewQuizDetails = (quiz) => {
    if (quiz) {
      setSelectedQuiz(quiz);
      setShowQuizDetails(true);
    }
  };
  
  const closeQuizDetails = () => {
    setShowQuizDetails(false);
    setSelectedQuiz(null);
  };
  
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      return 'Unknown date';
    }
  };
  
  const getTotalQuestionCount = () => {
    const activeQuizzes = quizzes.filter(quiz => quiz?.isActive);
    let totalQuestions = 0;
    
    activeQuizzes.forEach(quiz => {
      if (quiz?.data?.questions?.length) {
        totalQuestions += quiz.data.questions.length;
      }
    });
    
    return totalQuestions;
  };

  return (
    <div className="manage-quizzes-overlay">
      <div className="manage-quizzes-container">
        <div className="manage-quizzes-header">
          <h2>Quizzes Library</h2>
          <button className="close-button" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="upload-section">
          <div className="upload-buttons-container">
            <div className="start-quiz-container">
              {getTotalQuestionCount() > 0 && (
                <button 
                  onClick={() => {
                    onClose();
                  }} 
                  className="start-quiz-button"
                >
                  Start {getTotalQuestionCount()} questions quiz
                </button>
              )}
            </div>
            <label htmlFor="quiz-file-input" className="upload-icon-button">
              <UploadIcon />
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              id="quiz-file-input"
              className="file-input"
              ref={fileInputRef}
            />
          </div>
        </div>

        <div className="quizzes-list">
          {!quizzes || quizzes.length === 0 ? (
            <p className="no-quizzes-message">No question files are loaded yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Quiz Title</th>
                  <th className="questions-count-header-left">Questions</th>
                  <th className="actions-header"></th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map(quiz => quiz && (
                  <tr key={quiz.id} className={quiz.isActive ? 'active-row' : ''}>
                    <td className="quiz-title-cell">{quiz.title}</td>
                    <td className="questions-count-cell-left">{quiz.data?.questions?.length || 0}</td>
                    <td className="actions-cell">
                      <div className="action-buttons">
                        <div className="checkbox-container">
                          {toggleLoadingId === quiz.id ? (
                            <div className="spinner-tiny checkbox-spinner"></div>
                          ) : (
                            <input 
                              type="checkbox" 
                              id={`quiz-active-${quiz.id}`}
                              checked={quiz.isActive || false}
                              onChange={() => handleToggleActive(quiz.id)}
                              className="quiz-active-checkbox"
                              disabled={toggleLoadingId !== null}
                            />
                          )}
                        </div>
                        <button
                          onClick={() => viewQuizDetails(quiz)}
                          className="info-button-icon"
                          title="View quiz details"
                        >
                          <InfoIcon />
                        </button>
                        <button 
                          onClick={() => handleDelete(quiz.id)}
                          className="delete-button-icon"
                          title={quizToDelete === quiz.id ? "Click again to confirm deletion" : "Delete quiz"}
                        >
                          {quizToDelete === quiz.id ? <CheckIcon className="check-icon" /> : <TrashIcon />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {showQuizDetails && selectedQuiz && (
        <div className="quiz-details-overlay">
          <div className="quiz-details-container">
            <div className="quiz-details-header">
              <h3>{selectedQuiz.title}</h3>
              <button className="close-button" onClick={closeQuizDetails}>
                &times;
              </button>
            </div>
            <div className="quiz-details-content">
              <div className="quiz-details-summary">
                <p><strong>Total Questions:</strong> {selectedQuiz.data?.questions?.length || 0}</p>
                <p><strong>Date Added:</strong> {selectedQuiz.dateAdded ? formatDate(selectedQuiz.dateAdded) : 'N/A'}</p>
                <p><strong>Active:</strong> <span className={selectedQuiz.isActive ? "status-active" : "status-inactive"}>{selectedQuiz.isActive ? "Active" : "Inactive"}</span></p>
              </div>
              <div className="quiz-questions-preview">
                <h4>Questions:</h4>
                <div className="questions-preview-list">
                  {selectedQuiz.data?.questions?.map((question, index) => (
                      <div key={`preview-${index}`} className="question-preview-item">
                        <div className="question-preview-header">
                          <p className="question-preview-text"><strong>Q{index + 1}:</strong> {question.texte}</p>
                          <button 
                            onClick={() => removeQuestion(selectedQuiz.id, question.id)}
                            className="delete-question-button"
                            title="Remove this question"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      <div className="question-preview-answers">
                        <p className={question.correctAnswer === 'A' ? 'correct-answer' : ''}>A: {question.answerA}</p>
                        <p className={question.correctAnswer === 'B' ? 'correct-answer' : ''}>B: {question.answerB}</p>
                        <p className={question.correctAnswer === 'C' ? 'correct-answer' : ''}>C: {question.answerC}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="quiz-details-actions">
              <button 
                onClick={() => {
                  closeQuizDetails();
                  // Set only this quiz to active
                  setQuizzes(prevQuizzes => {
                    const updatedQuizzes = (prevQuizzes || []).map(quiz => 
                      quiz ? { ...quiz, isActive: quiz.id === selectedQuiz.id } : null
                    ).filter(Boolean);
                    return updatedQuizzes;
                  });
                  // Activate this quiz
                  onQuizActivated(selectedQuiz.data);
                  onClose();
                }} 
                className="start-quiz-button"
              >
                Start {selectedQuiz.data?.questions?.length || 0} questions quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageQuizzes;