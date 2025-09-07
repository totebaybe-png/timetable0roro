import * as React from "react"
import { cn } from "@/lib/utils"

const Dialog = ({ children, ...props }) => {
  const [open, setOpen] = React.useState(false)
  
  return (
    <div {...props}>
      {React.Children.map(children, child =>
        React.cloneElement(child, { open, setOpen })
      )}
    </div>
  )
}

const DialogTrigger = ({ children, open, setOpen }) => {
  return React.cloneElement(children, {
    onClick: () => setOpen(true)
  })
}

const DialogContent = ({ className, children, open, setOpen, ...props }) => {
  if (!open) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={() => setOpen(false)}
      />
      <div
        className={cn(
          "relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
          className
        )}
        {...props}
      >
        <button
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}

const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)

const DialogTitle = ({ className, ...props }) => (
  <h2
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
)

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle }