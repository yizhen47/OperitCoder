classDiagram
    class Vector~T~ {
        -T* _elem
        -int _size
        -int _capacity
        +push_back(e)
        +pop_back()
        +mergeSort()
    }
    
    class List~T~ {
        -ListNode~T~* header
        -ListNode~T~* trailer
        -int _size
        +insertAsLast(e)
        +insertionSort()
        +merge()
    }
    
    class Stack~T~ {
        +push(e)
        +pop()
        +top()
    }
    
    class HashTable~K,V~ {
        -List~HashEntry~* _buckets
        +put(key, value)
        +get(key)
        +remove(key)
    }
    
    class Queen {
        +int x, y
        +operator==(q)
    }
    
    class NQueenSolution {
        +Vector~Stack~Queen~~ solutions
        +placeQueens()
    }
    
    Stack~T~ --|> Vector~T~ : 继承
    HashTable~K,V~ *-- List~HashEntry~ : 组合
    NQueenSolution *-- Stack~Queen~ : 组合
    NQueenSolution *-- "Vector~Stack~Queen~~" : 组合

```
