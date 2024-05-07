'use client';

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from 'next/image';
import BAYARD_LAB_YELLOW from '@/assets/BAYARD_LAB_YELLOW.png';
import BAYARD_LAB from '@/assets/BAYARD_LAB.png';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpring, animated } from 'react-spring';
import { Lexend_Peta } from "next/font/google";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { toast, Toaster } from 'react-hot-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import * as amplitude from '@amplitude/analytics-browser';
import { autocapturePlugin } from '@amplitude/plugin-autocapture-browser';

const apiKey = process.env.AMPLITUDE_API_KEY || ""; // Set a default value if the API key is undefined
amplitude.init(apiKey);
amplitude.add(autocapturePlugin());


interface Message {
  user: string;
  text: string;
  timestamp: string;
}

interface Document {
  title: string;
  authors: string[];
  yearPublished: string;
  abstract: string;
  downloadUrl: string;
}

interface ChatHistory {
  messages: Message[];
  documents: Document[];
}

const lexendPetaStyle = Lexend_Peta({
  weight: '800',
  style: 'normal',
  subsets: ['latin']
});

function formatMessage(message: string): string {
  return message.replace(/\n/g, '<br>');
}

async function sendMessage(message: string) {
  const response = await fetch('/api/bayard-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input_text: message }),
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  const data = await response.json();
  return data;
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatHistory>({ messages: [], documents: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);


  const [modelOutput, setModelOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");

  const springProps = useSpring({
    from: { opacity: 0, transform: 'translateY(20px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
    config: { tension: 220, friction: 20 },
  });

  useEffect(() => {
    // Check if the user has a preferred color scheme
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDarkMode);

    // Apply dark mode class to body element
    document.body.classList.toggle('dark', prefersDarkMode);
  }, []);

  const toggleDarkMode = () => {
    console.log('toggleDarkMode called');
    const newIsDarkMode = !isDarkMode;
    setIsDarkMode(newIsDarkMode);
    document.body.classList.toggle('dark', newIsDarkMode);
  };
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory.messages]);

  useEffect(() => {
    if (isStreaming) {
      const timer = setTimeout(() => {
        setStreamedText((prevText) => {
          const newText = modelOutput.slice(0, prevText.length + 1);
          if (newText === modelOutput) {
            setIsStreaming(false);
          }
          return newText;
        });
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isStreaming, modelOutput, streamedText]);

  const sendMessage = async () => {
    if (message.trim() === '') return;

    const userMessage: Message = {
      user: 'You',
      text: message,
      timestamp: new Date().toLocaleString(), // Add timestamp
    };

    setChatHistory((prevChatHistory) => ({
      ...prevChatHistory,
      messages: [...prevChatHistory.messages, userMessage],
    }));

    setMessage('');
    setIsLoading(true);
    setLoadingStatus('Thinking...');

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate thinking delay
      setLoadingStatus('Querying...');

      const response = await fetch('/api/bayard-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input_text: message }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate querying delay
      setLoadingStatus('Generating...');

      const data = await response.json();
      const botMessage: Message = {
        user: 'Bayard',
        text: data.model_output,
        timestamp: new Date().toLocaleString(), // Add timestamp
      };


      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate generating delay

      setChatHistory((prevChatHistory) => ({
        messages: [...prevChatHistory.messages, botMessage],
        documents: data.documents || [],
      }));
    } catch (error) {
      console.error('Error:', error);
    }

    setIsLoading(false);
    setLoadingStatus('');
  };

  const regenerateResponse = async () => {
    setIsLoading(true);
    setLoadingStatus('Generating...');

    try {
      const lastUserMessage = chatHistory.messages[chatHistory.messages.length - 1].text;

      // Create a new message object with the last user message
      const message: Message = {
        user: 'You',
        text: lastUserMessage,
        timestamp: new Date().toLocaleString(),
      };

      // Add the message to the chat history
      setChatHistory((prevChatHistory) => ({
        ...prevChatHistory,
        messages: [...prevChatHistory.messages, message],
      }));

      // Send the message to the backend for processing
      await sendMessage(); // Remove the argument from the function call
    } catch (error) {
      console.error('Error:', error);
    }

    setIsLoading(false);
    setLoadingStatus('');
  };

  const [asideWidth, setAsideWidth] = useState(400);
  const asideRef = useRef<HTMLElement>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (asideRef.current) {
      asideRef.current.style.transition = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (asideRef.current) {
      const newWidth = e.clientX;
      asideRef.current.style.width = `${newWidth}px`;
    }
  };

  const handleMouseUp = () => {
    if (asideRef.current) {
      asideRef.current.style.transition = "width 0.3s ease-in-out";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Show a success message or toast notification
      toast.success('Message copied to clipboard');
    }).catch((error) => {
      console.error('Failed to copy message:', error);
      // Show an error message or toast notification
      toast.error('Failed to copy message');
    });
  };

  const shareMessage = (text: string) => {
    if (navigator.share) {
      navigator.share({
        title: 'Bayard Chat Message',
        text: text,
      }).then(() => {
        // Sharing successful
        toast.success('Message shared successfully');
      }).catch((error) => {
        console.error('Failed to share message:', error);
        // Fallback to a custom share dialog or message
        toast.error('Failed to share message');
      });
    } else {
      // Fallback to a custom share dialog or message
      toast('Sharing not supported', {
        icon: '❕',
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
      });
    }
  };

  const provideFeedback = (message: Message) => {
    // Open a modal or dialog to collect feedback
    const feedback = prompt('Please provide your feedback for this message:', '');

    if (feedback !== null) {
      // Send the feedback to the server or perform any necessary actions
      console.log('Feedback submitted:', feedback);
      // Show a success message or toast notification
      toast.success('Feedback submitted successfully');
    }
  };

  return (
    <div className="flex flex-col h-screen text-base bg-gray-100 dark:bg-gray-900 dark:text-base dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:bg-fixed dark:bg-opacity-100">
      <header className="bg-gradient-to-r from-amber-200 to-amber-100 dark:from-gray-900 dark:to-gray-800 text-gray-800 dark:text-amber-500 py-3 px-6 flex items-center justify-between shadow-lg backdrop-filter backdrop-blur-2xl bg-opacity-10">
        <a href="https://bayardlab.org" target="_blank" rel="noopener noreferrer">
          <Image src={isDarkMode ? BAYARD_LAB_YELLOW : BAYARD_LAB} alt="Bayard Lab Logo" width={150} height={50} />
        </a>
        <h1 className={`${lexendPetaStyle.className} uppercase text-sm`}>Bayard_One</h1>
        <nav>
          <ul className="flex space-x-4 items-center">
            <li>
              <a href="https://bayardlab.org" target="_blank" rel="noopener noreferrer" className="text-sm hover:text-gray-600 dark:hover:text-amber-400">
                Home
              </a>
            </li>
            <li>
              <a href="https://www.bayardlab.org/about-bayard-one" target="_blank" rel="noopener noreferrer" className="text-sm hover:text-gray-600 dark:hover:text-amber-400">
                About
              </a>
            </li>
            <li>
              <a href="https://docs.bayardlab.org" target="_blank" rel="noopener noreferrer" className="text-sm hover:text-gray-600 dark:hover:text-amber-400">
                Documentation
              </a>
            </li>
            <li>
              <a href="https://www.bayardlab.org/contact" target="_blank" rel="noopener noreferrer" className="text-sm hover:text-gray-600 dark:hover:text-amber-400">
                Contact
              </a>
            </li>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleDarkMode}
                    className="p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                  >
                    <span className="sr-only">Toggle Dark Mode</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className={`w-5 h-5 ${isDarkMode ? 'text-amber-500' : 'text-gray-500'}`}
                    >
                      {isDarkMode ? (
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M12 1C5.92487 1 1 5.92487 1 12C1 18.0751 5.92487 23 12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1ZM12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3V21Z"
                        />
                      ) : (
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM12 20V4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20Z"
                        />
                      )}
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={30}>
                  <p>{isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </ul>
        </nav>
      </header>
      <div className="bg-gray-800 text-amber-100 dark:bg-amber-100 dark:text-gray-800 p-4 shadow-md flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-amber-400 dark:text-amber-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-xs">
          <strong>Caution:</strong> Bayard is an open-source, alpha-stage AI research assistant designed to facilitate access to LGBTQ+ scholarship; while it aims to provide reliable information, users should think critically, fact-check key details, and consult primary sources as they would with any research tool.
        </p>
      </div>
      <main className="flex flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel className="shadow-md">
            <aside
              ref={asideRef}
              className="bg-amber-50 dark:bg-gray-700 p-4 pl-10 pr-10 transition-all duration-300 overflow-y-auto shadow-lg z-10 relative h-full"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-amber-400 mb-3">Documents</h2>
                  <div className="mt-2">
                    {chatHistory.documents.length > 0 && (
                      <>
                        <p className="text-xs text-gray-600 dark:text-amber-300 mb-3">
                          {chatHistory.documents.filter((doc) => doc.abstract).length === 1
                            ? '1 document with an abstract'
                            : `${chatHistory.documents.filter((doc) => doc.abstract).length} documents with abstracts`
                          }
                        </p>
                        {chatHistory.documents.filter((doc) => !doc.abstract).length > 0 && (
                          <p className="text-xs text-gray-600 dark:text-amber-300 mt-1 mb-3">
                            {chatHistory.documents.filter((doc) => !doc.abstract).length === 1
                              ? '1 document without an abstract'
                              : `${chatHistory.documents.filter((doc) => !doc.abstract).length} documents without abstracts`
                            }
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div
                  className="w-2 h-full bg-amber-300 dark:bg-gray-500 hover:bg-amber-400 dark:hover:bg-gray-400 cursor-col-resize"
                  onMouseDown={handleMouseDown}
                ></div>
              </div>
              {chatHistory.documents.length > 0 && (
                <>
                  <div className="max-h-[calc(100vh-200px)]">
                    {chatHistory.documents
                      .filter((doc) => doc.abstract)
                      .map((doc, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                        >
                          <Card className="mb-6 p-4 bg-gradient-to-r from-amber-100 to-amber-200 dark:from-gray-700/100 dark:to-gray-900/50 text-gray-800 dark:text-amber-400 shadow-md rounded-lg">
                            <CardHeader>
                              <CardTitle className="text-xl">{doc.title}</CardTitle>
                              <CardDescription>
                                <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                                  <strong>Authors:</strong> {doc.authors.join(", ")}
                                </p>
                                <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                                  <strong>Year Published:</strong> {doc.yearPublished}
                                </p>
                                <p className="mt-5 text-s mt-1 text-gray-600 dark:text-gray-300">
                                  <strong>Abstract:</strong> {doc.abstract.length > 500 ? doc.abstract.slice(0, 500) + "..." : doc.abstract}
                                </p>
                              </CardDescription>
                            </CardHeader>
                            <CardFooter>
                              <div className="flex items-center justify-between">
                                <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" className="bg-gray-800 text-amber-100 dark:bg-amber-500 dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-amber-600 font-bold py-2 px-4 rounded">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download
                                  </Button>
                                </a>
                              </div>
                            </CardFooter>
                          </Card>
                        </motion.div>
                      ))}
                  </div>
                </>
              )}
              {chatHistory.documents.length === 0 && !isLoading && (
                <p className="text-xs text-gray-600 dark:text-amber-300 mt-2">No documents found</p>
              )}
            </aside>
          </ResizablePanel>
          <ResizableHandle style={{ width: '2px' }} />
          <ResizablePanel className="shadow-md">
            <div className="w-0.5 bg-amber-200 dark:bg-gray-600"></div>
            <section className="flex-1 flex flex-col overflow-hidden" style={{ width: '100%', height: '100%' }}>
              <div className="flex items-center justify-between p-4 pr-10 pl-10 bg-amber-50 dark:bg-gray-800 text-gray-800 dark:text-amber-400">
                <h2 className="text-lg font-semibold">Chat</h2>
              </div>
              <div ref={chatContainerRef} className="flex-1 p-4 pr-10 pl-10 bg-amber-50 dark:bg-gray-800 overflow-y-auto">
                <AnimatePresence>
                  {chatHistory.messages.map((message, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card
                        className={`mb-4 p-4 rounded-lg shadow-md backdrop-filter backdrop-blur-2xl bg-opacity-30 ${message.user === 'You' ? 'bg-gradient-to-l from-amber-100/70 to-amber-300/70 dark:from-gray-700/70 dark:to-gray-900/70 text-gray-800 dark:text-amber-500' : 'bg-gradient-to-r from-amber-100/70 to-amber-300/70 dark:from-gray-700/90 dark:to-gray-900/40 text-gray-800 dark:text-amber-500'
                          }`}
                      >
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Avatar className="w-6 h-6">
                                <AvatarFallback className="text-xs bg-slate-500">{message.user.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-semibold">{message.user}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-100">{message.timestamp}</p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                className="text-xs text-gray-600 dark:text-amber-400 hover:text-gray-800 dark:hover:text-amber-300"
                                onClick={() => copyToClipboard(message.text)}
                              >
                                Copy
                              </button>
                              <button
                                className="text-xs text-gray-600 dark:text-amber-400 hover:text-gray-800 dark:hover:text-amber-300"
                                onClick={() => shareMessage(message.text)}
                              >
                                Share
                              </button>
                              {message.user === 'Bayard' && (
                                <button
                                  className="text-xs text-gray-600 dark:text-amber-400 hover:text-gray-800 dark:hover:text-amber-300"
                                  onClick={() => provideFeedback(message)}
                                >
                                  Feedback
                                </button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="mt-2">
                          {message.user === 'Bayard' && isStreaming && message.text === modelOutput ? (
                            <animated.p className="text-xs" style={{ ...springProps, lineHeight: '1.4' }}>
                              {streamedText}
                              <span className="animate-pulse">|</span>
                            </animated.p>
                          ) : (
                            <div
                              className="text-sm text-gray-800 dark:text-amber-400"
                              style={{ lineHeight: '1.6' }}
                              dangerouslySetInnerHTML={{ __html: message.user === 'Bayard' ? formatMessage(message.text) : message.text }}
                            />
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0.6 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0.97 }}
                    transition={{ duration: 0.1 }}
                    className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50 dark:bg-opacity-70"
                  >
                    <div className="text-center w-1/2">
                      <div className="relative">
                        <div className="w-full h-2 bg-gray-300 rounded-full">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${loadingStatus === 'Thinking...' ? '33%' : loadingStatus === 'Querying...' ? '66%' : '100%'}` }}
                            transition={{ duration: 0.1, ease: 'easeOut' }}
                            className="absolute top-0 left-0 h-2 bg-amber-500 rounded-full"
                          />
                        </div>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
                          className="absolute top-0 left-0 w-full h-2 bg-white rounded-full opacity-25"
                        />
                      </div>
                      <motion.p
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.1, delay: 0.1 }}
                        className="mt-1 text-amber-300 dark:text-amber-300 text-lg"
                      >
                        {loadingStatus}
                      </motion.p>
                    </div>
                  </motion.div>
                )}
              </div>
              <div className="p-4 bg-gradient-to-r from-amber-200 dark:from-gray-800 to-amber-100 dark:to-gray-900 backdrop-filter backdrop-blur-md bg-opacity-30">
                <div className="flex space-x-2">
                  <div className="flex-1 mr-2">
                    <Textarea
                      value={message}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      className="w-full px-4 py-3 bg-amber-50 dark:bg-gray-700 text-gray-800 dark:text-amber-300 border border-amber-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="What would you like to ask Bayard?"
                    />
                  </div>
                  <div className="flex flex-col space-y-2 mr-2">
                    <Button
                      onClick={sendMessage}
                      disabled={isLoading}
                      className="relative flex items-center justify-center mt-2 w-16 h-16 rounded-full bg-gray-800 text-amber-100 dark:bg-amber-500 dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-amber-600 font-bold group transition-colors duration-300"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-6 h-6 animate-spin"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6m0 0v6" />
                          </svg>
                        </span>
                      ) : (
                          <span className="relative flex items-center justify-center">
                            <span className="w-2 h-2 border-t-2 border-r-2 border-amber-100 dark:border-gray-900 transform -rotate-45 transition-transform duration-300 ease-in-out group-hover:scale-110"></span>
                          </span>
                      )}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 hidden group-hover:block mb-2 transition-opacity duration-300 ease-in-out">
                              <span className="bg-gray-800 text-amber-100 dark:bg-amber-500 dark:text-gray-900 px-2 py-1 rounded text-xs whitespace-nowrap">
                                {isLoading ? 'Sending...' : 'Send'}
                              </span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <span className="bg-gray-800 text-amber-100 dark:bg-amber-500 dark:text-gray-900 px-2 py-1 rounded text-xs whitespace-nowrap">
                              {isLoading ? 'Sending...' : 'Send'}
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
      <footer>
        <div className="bg-gradient-to-r from-amber-200 dark:from-gray-800 to-amber-100 dark:to-gray-900 text-gray-600 dark:text-gray-400 py-4 px-6 flex items-center justify-between text-xs backdrop-filter backdrop-blur-3xl bg-opacity-20 bg-amber-100/60 dark:bg-gray-800/60 shadow-lg">
          <div>
            <span>© {new Date().getFullYear()} Bayard Lab. All rights reserved. Open-source use subject to <a href="https://docs.bayardlab.org/wl1.0gp-license-terms" target="_blank" rel="noopener noreferrer" className="underline text-amber-700 dark:text-amber-500 hover:text-gray-600 dark:hover:text-amber-400">terms</a>.</span>
          </div>
          <div>
            <a href="https://bayardlab.org/terms" target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 text-xs hover:text-gray-800 dark:hover:text-amber-500 mr-4">
              Terms & Conditions
            </a>
            <a href="https://bayardlab.org/privacy-notice" target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 text-xs hover:text-gray-800 dark:hover:text-amber-500">
              Privacy Notice
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}                    