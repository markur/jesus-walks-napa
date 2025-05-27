import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { PlusIcon, ImageIcon, UploadIcon, ClipboardIcon } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Product } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AdminProducts() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isPreviewValid, setIsPreviewValid] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file' | 'clipboard'>('url');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);
  
  // Reset form state when dialog is closed
  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      // Reset form state
      setImageUrl("");
      setIsPreviewValid(false);
      setUploadMethod('url');
    }
  };

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const createProduct = useMutation({
    mutationFn: async (formData: FormData) => {
      // Extract form data and ensure proper type conversion
      const name = formData.get("name")?.toString();
      const description = formData.get("description")?.toString();
      const priceStr = formData.get("price")?.toString();
      const category = formData.get("category")?.toString();
      const stockStr = formData.get("stock")?.toString();

      if (!name || !description || !priceStr || !category || !stockStr || !imageUrl) {
        throw new Error("All fields are required");
      }

      const price = parseFloat(priceStr);
      const stock = parseInt(stockStr);

      if (isNaN(price) || price <= 0) {
        throw new Error("Please enter a valid price");
      }

      if (isNaN(stock) || stock < 0) {
        throw new Error("Please enter a valid stock quantity");
      }

      const product = {
        name,
        description,
        price: price.toString(), // Convert to string for decimal compatibility
        imageUrl,
        category,
        stock,
      };

      await apiRequest("POST", "/api/products", product);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Product created successfully",
      });
      setIsDialogOpen(false);
      setImageUrl("");
      setIsPreviewValid(false);
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImagePreview = (url: string) => {
    setImageUrl(url);
    const img = new Image();
    img.onload = () => setIsPreviewValid(true);
    img.onerror = () => setIsPreviewValid(false);
    img.src = url;
  };
  
  // Handle file upload through file input
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    
    // Check file type
    const fileType = file.type;
    if (!fileType.match(/^image\/(jpeg|jpg|png|gif|webp|svg\+xml)$/i)) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPEG, PNG, GIF, WebP, or SVG)",
        variant: "destructive",
      });
      return;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }
    
    setUploadLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/upload/product-image', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Upload failed');
      }
      
      setImageUrl(result.imageUrl);
      setIsPreviewValid(true);
      
      toast({
        title: "Upload successful",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
      setIsPreviewValid(false);
    } finally {
      setUploadLoading(false);
    }
  };
  
  // Handle clipboard paste
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    
    for (const item of Array.from(items)) {
      if (item.type.indexOf('image') === 0) {
        const blob = item.getAsFile();
        if (blob) {
          await handleClipboardImage(blob);
          break;
        }
      }
    }
  };
  
  // Handle drag and drop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await handleClipboardImage(file);
    }
  };
  
  // Process image from clipboard or drag and drop
  const handleClipboardImage = async (file: File) => {
    setUploadLoading(true);
    
    try {
      // Convert to base64
      const reader = new FileReader();
      
      const imageData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      // Upload the base64 data
      const response = await fetch('/api/upload/base64-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData,
          filename: 'clipboard-image'
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Upload failed');
      }
      
      setImageUrl(result.imageUrl);
      setIsPreviewValid(true);
      
      toast({
        title: "Image pasted",
        description: "Image processed successfully",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process image",
        variant: "destructive",
      });
      setIsPreviewValid(false);
    } finally {
      setUploadLoading(false);
    }
  };
  
  // Handle direct file selection
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };
  
  // Effect for handling global paste events when clipboard tab is active
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (uploadMethod !== 'clipboard' || !isDialogOpen) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (const item of Array.from(items)) {
        if (item.type.indexOf('image') === 0) {
          const blob = item.getAsFile();
          if (blob) {
            handleClipboardImage(blob);
            break;
          }
        }
      }
    };
    
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [uploadMethod, isDialogOpen]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!imageUrl || !isPreviewValid) {
      toast({
        title: "Error",
        description: "Please provide a valid product image",
        variant: "destructive",
      });
      return;
    }
    
    const formData = new FormData(e.currentTarget);
    
    // Make sure the image URL is passed correctly
    if (!formData.get('imageUrl')) {
      formData.set('imageUrl', imageUrl);
    }
    
    createProduct.mutate(formData);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" required />
              </div>
              <div>
                <Label htmlFor="price">Price</Label>
                <Input 
                  id="price" 
                  name="price" 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  required 
                />
              </div>
              <div>
                <Label>Product Image</Label>
                <input 
                  type="hidden" 
                  name="imageUrl" 
                  value={imageUrl} 
                  required 
                />
                <Tabs 
                  defaultValue="url" 
                  className="w-full" 
                  value={uploadMethod} 
                  onValueChange={(value) => setUploadMethod(value as 'url' | 'file' | 'clipboard')}
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="url">
                      <ImageIcon className="h-4 w-4 mr-2" />
                      URL
                    </TabsTrigger>
                    <TabsTrigger value="file">
                      <UploadIcon className="h-4 w-4 mr-2" />
                      Upload
                    </TabsTrigger>
                    <TabsTrigger value="clipboard">
                      <ClipboardIcon className="h-4 w-4 mr-2" />
                      Paste
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="url" className="mt-2">
                    <div className="flex gap-2">
                      <Input 
                        id="imageUrl"
                        value={imageUrl}
                        onChange={(e) => handleImagePreview(e.target.value)}
                        placeholder="Enter image URL"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Paste a direct URL to an image (JPG, PNG, GIF, WebP, or SVG)
                    </p>
                  </TabsContent>
                  
                  <TabsContent value="file" className="mt-2">
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                        onChange={handleFileInputChange}
                      />
                      <Button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadLoading}
                        className="w-full"
                      >
                        {uploadLoading ? "Uploading..." : "Choose Image"}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select an image from your device (max 5MB)
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="clipboard" className="mt-2">
                    <div 
                      ref={pasteAreaRef}
                      onPaste={handlePaste}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                      style={{ minHeight: "120px" }}
                      tabIndex={0}
                    >
                      {uploadLoading ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                          <p className="text-sm">Processing image...</p>
                        </div>
                      ) : (
                        <>
                          <ClipboardIcon className="h-10 w-10 text-muted-foreground mb-2" />
                          <p className="text-center font-medium">Paste or drop an image here</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Press Ctrl+V to paste from clipboard or drag & drop an image
                          </p>
                        </>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
                
                {/* Common image preview */}
                {imageUrl && (
                  <div className="mt-4">
                    {isPreviewValid ? (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden border">
                        <img 
                          src={imageUrl} 
                          alt="Product preview" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2">
                          <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs">
                            Valid Image
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-red-50 text-red-500 p-2 rounded">
                        Invalid image. Please try another one.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" required />
              </div>
              <div>
                <Label htmlFor="stock">Stock</Label>
                <Input 
                  id="stock" 
                  name="stock" 
                  type="number" 
                  min="0" 
                  required 
                />
              </div>
              <Button 
                type="submit" 
                className="w-full mb-4"
                disabled={createProduct.isPending || !isPreviewValid}
              >
                {createProduct.isPending ? "Creating..." : "Create Product"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products?.map((product) => (
          <Card key={product.id}>
            <CardContent className="p-4">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
              <h3 className="font-semibold">{product.name}</h3>
              <p className="text-sm text-muted-foreground">{product.description}</p>
              <div className="mt-2 flex justify-between items-center">
                <span className="font-bold">${Number(product.price).toFixed(2)}</span>
                <span className="text-sm text-muted-foreground">
                  Stock: {product.stock}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
}