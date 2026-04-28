import './loader.css'

  
const Loader = () => {
  return (
      <div className="w-full min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Ang loader animation */}
        <div 
          className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-t-transparent"
          role="status"
          aria-label="Loading"
        />
        <p className="text-muted-foreground font-medium">Loading, please wait...</p>
      </div>
    </div>
    )
  }
  
  export default Loader
