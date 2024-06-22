import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sort'
})
export class SortPipe implements PipeTransform {

  transform(value : unknown) : any[] {
    let array = Array.from(value);
    array.sort();
    return array;
  }
}
